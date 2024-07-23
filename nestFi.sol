// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title NestFi
 * @dev A smart contract for a savings account with borrowing capability using Aave protocol.
 */
interface ILendingPool {
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveData(address asset) external view returns (
        uint256 configuration,
        uint128 liquidityIndex,
        uint128 variableBorrowIndex,
        uint128 currentLiquidityRate,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        uint40 lastUpdateTimestamp,
        uint16 id,
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress,
        address interestRateStrategyAddress
    );
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

contract NestFi is ERC20, Ownable {
    IERC20 public stablecoin; // Instance of the ERC20 token (USDC) used for deposits and withdrawals
    ILendingPool public lendingPool; // Instance of the Aave lending pool interface
    IAToken public aToken; // Instance of the Aave aToken (USDC aToken)
    uint256 public constant COLLAT_RATIO = 50; // Loan-to-value ratio set to 50%
    uint256 public constant FEE_PERCENTAGE = 5; // Fee percentage (0.05%)

    // Struct to hold user information including deposit, loan amount, and liquidity index
    struct UserInfo {
        uint256 deposit;
        uint256 loan;
        uint128 userLiquidityIndex;
    }

    mapping(address => UserInfo) public users; // Mapping to store user-specific data
    uint128 public globalLiquidityIndex; // The global liquidity index used for compounding
    uint256 public lastCompoundTime; // Timestamp of the last compound operation

    // State variables to track total deposits and total loans
    uint256 public totalDeposits;
    uint256 public totalLoans;

    // Events to log important actions
    event ReserveDataRetrieved(uint128 liquidityIndex);
    event InitializationFailed(string reason);

    /**
     * @dev Constructor to initialize the contract with stablecoin, lendingPool, and aToken addresses.
     * @param _stablecoin Address of the stablecoin contract (USDC)
     * @param _lendingPool Address of the Aave lending pool contract
     * @param _aToken Address of the Aave aToken (USDC aToken)
     */
    constructor(address _stablecoin, address _lendingPool, address _aToken)
        ERC20("NEST Token", "NEST")
        Ownable(msg.sender)
    {
        stablecoin = IERC20(_stablecoin);
        lendingPool = ILendingPool(_lendingPool);
        aToken = IAToken(_aToken);
        stablecoin.approve(address(lendingPool), type(uint256).max); // Approve the lending pool to spend stablecoins
        initialize();
    }

    /**
     * @dev Initializes the contract by retrieving the current liquidity index from the lending pool.
     * This function should be called once after deploying the contract.
     */
    function initialize() internal {
        try lendingPool.getReserveData(address(stablecoin)) returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 variableBorrowIndex,
            uint128 currentLiquidityRate,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress
        ) {
            globalLiquidityIndex = liquidityIndex; // Set the initial global liquidity index
            lastCompoundTime = block.timestamp; // Record the current time as the last compound time
            emit ReserveDataRetrieved(liquidityIndex); // Emit an event to indicate successful retrieval
        } catch (bytes memory reason) {
            emit InitializationFailed(string(reason)); // Emit an event if initialization fails
        }
    }

    /**
     * @dev Overrides the default decimals function to set precision to 6 decimals.
     * @return The number of decimals for the token
     */
    function decimals() public view virtual override returns (uint8) {
        return 6; // 6 decimals
    }

    /**
     * @dev Deposits a specified amount of stablecoins into the Aave lending pool.
     * Updates the user's deposit, total deposits, and liquidity index.
     * @param amount The amount of stablecoins to deposit
     */
    function deposit(uint256 amount) external {
        autoCompoundGlobal(); // Automatically compound yield before depositing
        updateUserYield(msg.sender); // Update user's yield before making a new deposit

        uint256 fee = (amount * FEE_PERCENTAGE) / 10000; // Calculate the fee (0.05%)
        uint256 depositAmount = amount - fee; // Amount to deposit into Aave

        stablecoin.transferFrom(msg.sender, address(this), amount); // Transfer stablecoins from the user to the contract
        stablecoin.transfer(owner(), fee); // Transfer the fee to the contract owner

        lendingPool.deposit(address(stablecoin), depositAmount, address(this), 0); // Deposit stablecoins into Aave

        UserInfo storage user = users[msg.sender];
        user.deposit += depositAmount; // Increase user's deposit balance
        user.userLiquidityIndex = globalLiquidityIndex; // Update user's liquidity index

        totalDeposits += depositAmount; // Update the total deposits

        // Automatically repay loan if user has a loan
        if (user.loan > 0) {
            autoRepay(0); // Call autoRepay with 0 NEST tokens to burn, just using yield
        }
    }

    /**
     * @dev Withdraws a specified amount of stablecoins from the Aave lending pool.
     * Repays any required loan and updates the user's deposit, total deposits, and liquidity index.
     * @param amount The amount of stablecoins to withdraw
     */
    function withdraw(uint256 amount) external {
        UserInfo storage user = users[msg.sender];
        
        require(user.deposit >= amount, "Insufficient deposit"); // Ensure the user has sufficient deposit

        autoCompoundGlobal(); // Automatically compound yield before withdrawing
        updateUserYield(msg.sender); // Update user's yield before making a withdrawal

        uint256 collateralAfterWithdrawal = user.deposit - amount; // Calculate remaining collateral after withdrawal
        uint256 maxLoanAmountAfterWithdrawal = (collateralAfterWithdrawal * COLLAT_RATIO) / 100; // Calculate maximum allowable loan amount

        // Ensure no underflow in loan repayment calculation
        uint256 loanRepaymentRequired = (user.loan > maxLoanAmountAfterWithdrawal) ? (user.loan - maxLoanAmountAfterWithdrawal) : 0;

        if (loanRepaymentRequired > 0) {
            require(balanceOf(msg.sender) >= loanRepaymentRequired, "Insufficient tokens to repay loan"); // Ensure the user has enough tokens to repay the loan
            _burn(msg.sender, loanRepaymentRequired); // Burn the required number of NEST tokens
            user.loan -= loanRepaymentRequired; // Reduce the user's loan balance
            totalLoans -= loanRepaymentRequired; // Update the total loans
        }

        lendingPool.withdraw(address(stablecoin), amount, msg.sender); // Withdraw stablecoins from Aave
        user.deposit -= amount; // Reduce user's deposit balance
        user.userLiquidityIndex = globalLiquidityIndex; // Update user's liquidity index

        totalDeposits -= amount; // Update the total deposits
    }

    /**
     * @dev Allows users to borrow a specified amount of stablecoins.
     * Updates the user's loan balance and total loans.
     * @param amount The amount of stablecoins to borrow
     */
    function borrow(uint256 amount) external {
        UserInfo storage user = users[msg.sender];
        autoCompoundGlobal();
        updateUserYield(msg.sender); // Update user's yield before borrowing

        uint256 collateral = (user.deposit * COLLAT_RATIO) / 100; // Calculate available collateral
        require(collateral >= user.loan + amount, "Insufficient collateral"); // Ensure sufficient collateral

        _mint(msg.sender, amount); // Mint new NEST tokens for the user
        user.loan += amount; // Increase the user's loan balance
        totalLoans += amount; // Update the total loans

        // Automatically repay loan if user has a loan
        if (user.loan > 0) {
            autoRepay(0); // Call autoRepay with 0 NEST tokens to burn, just using yield
        }
    }

    /**
    * @dev Allows users to automatically repay their loan using accrued yield and optionally burn NEST tokens.
    * Updates the user's loan balance, deposit balance, and total loans.
    * @param nestToBurn The amount of NEST tokens the user wants to burn to repay the loan faster
    */
    function autoRepay(uint256 nestToBurn) public {
        autoCompoundGlobal();
        UserInfo storage user = users[msg.sender];

        uint256 yield = getAccruedYield(msg.sender); // Get the accrued yield for the user

        // Withdraw the accrued yield from Aave
        if (yield > 0) {
            lendingPool.withdraw(address(stablecoin), yield, address(this));
            user.loan -= yield;
            totalLoans -= yield; // Update the total loans
        }

        uint256 remainingLoan = user.loan;

        if (remainingLoan > 0) {
            if (nestToBurn > 0) {
                uint256 burnAmount = nestToBurn > remainingLoan ? remainingLoan : nestToBurn;
                _burn(msg.sender, burnAmount);
                user.loan -= burnAmount;
                totalLoans -= burnAmount; // Update the total loans
            }

            // Reset the user's accrued yield by updating the user's liquidity index
            user.userLiquidityIndex = globalLiquidityIndex;
            updateUserYield(msg.sender); // Update user's yield after repayment
        }
    }

    /**
     * @dev Automatically compounds the global yield by withdrawing and redepositing funds.
     * Updates the global liquidity index.
     */
    function autoCompoundGlobal() public {
        uint128 currentLiquidityIndex = getCurrentLiquidityIndex(); // Get the current liquidity index from Aave
        if (currentLiquidityIndex > globalLiquidityIndex) {
            // Withdraw the entire aToken balance
            uint256 aTokenBalance = aToken.balanceOf(address(this));
            if (aTokenBalance > 0) {
                lendingPool.withdraw(address(stablecoin), aTokenBalance, address(this));
                
                // Get the total balance of stablecoins after withdrawal
                uint256 totalBalance = stablecoin.balanceOf(address(this));
                
                // Re-deposit the withdrawn stablecoins into Aave
                lendingPool.deposit(address(stablecoin), totalBalance, address(this), 0);
                
                // Update the global liquidity index
                globalLiquidityIndex = currentLiquidityIndex;
                lastCompoundTime = block.timestamp; // Update the last compound time
            }
        }
    }

    /**
     * @dev Updates the user's yield based on the current global liquidity index.
     * @param userAddr The address of the user whose yield needs to be updated
     */
    function updateUserYield(address userAddr) internal {
        UserInfo storage user = users[userAddr];
        uint256 yield = getAccruedYield(userAddr); // Get the accrued yield for the user
        if (yield > 0) {
            user.deposit += yield; // Increase the user's deposit balance
            user.userLiquidityIndex = globalLiquidityIndex; // Update user's liquidity index
        }
    }

    /**
     * @dev Calculates the accrued yield for a specific user.
     * @param userAddr The address of the user
     * @return The accrued yield amount
     */
    function getAccruedYield(address userAddr) public view returns (uint256) {
        UserInfo storage user = users[userAddr];
        uint128 currentLiquidityIndex = getCurrentLiquidityIndex(); // Get the current liquidity index
        uint256 depositAmount = user.deposit;
        uint128 userLiquidityIndex = user.userLiquidityIndex;

        if (currentLiquidityIndex > userLiquidityIndex) {
            uint256 accruedYield = (depositAmount * (currentLiquidityIndex - userLiquidityIndex)) / 1e27;
            return accruedYield; // Return the calculated accrued yield
        } else {
            return 0; // No yield if the current liquidity index is not greater
        }
    }

    /**
     * @dev Gets the current liquidity index for the stablecoin from the lending pool.
     * @return The current liquidity index
     */
    function getCurrentLiquidityIndex() internal view returns (uint128) {
        (, uint128 liquidityIndex, , , , , , , , , , ) = lendingPool.getReserveData(address(stablecoin));
        return liquidityIndex;
    }

    /**
     * @dev Gets the deposit balance of a specific user.
     * @param userAddr The address of the user
     * @return The deposit balance of the user
     */
    function getDeposit(address userAddr) external view returns (uint256) {
        return users[userAddr].deposit;
    }

    /**
     * @dev Gets the loan balance of a specific user.
     * @param userAddr The address of the user
     * @return The loan balance of the user
     */
    function getLoan(address userAddr) external view returns (uint256) {
        return users[userAddr].loan;
    }
    
    /**
     * @dev Gets the total deposits tracked by the contract.
     * @return The total deposits
     */
    function getTotalDeposits() external view returns (uint256) {
        return totalDeposits;
    }

    /**
     * @dev Gets the total loans tracked by the contract.
     * @return The total loans
     */
    function getTotalLoans() external view returns (uint256) {
        return totalLoans;
    }
}
