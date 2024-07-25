// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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

contract NestFi is ERC20, Ownable, ReentrancyGuard {
    IERC20 public stablecoin; // Instance of the ERC20 token (USDC) used for deposits and withdrawals
    ILendingPool public lendingPool; // Instance of the Aave lending pool interface
    IAToken public aToken; // Instance of the Aave aToken (USDC aToken)
    uint256 public COLLAT_RATIO = 50; // Loan-to-value ratio set to 50%
    uint256 public YIELD_FEE_PERCENTAGE = 100; // 1% fee on yield (in basis points)
    uint256 public FLASHLOAN_FEE_PERCENTAGE = 5; // 0.05% flashloan fee (in basis points)


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
    event FlashloanExecuted(address indexed borrower, uint256 amount, uint256 fee);

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

        stablecoin.transferFrom(msg.sender, address(this), amount); // Transfer stablecoins from the user to the contract
        lendingPool.deposit(address(stablecoin), amount, address(this), 0); // Deposit stablecoins into Aave

        UserInfo storage user = users[msg.sender];
        user.deposit += amount; // Increase user's deposit balance
        user.userLiquidityIndex = globalLiquidityIndex; // Update user's liquidity index

        totalDeposits += amount; // Update the total deposits

        // Automatically repay loan if user has a loan
        if (user.loan > 0) {
            autoRepay(); // Call autoRepay
        }
    }

    /**
     * @dev Withdraws a specified amount of stablecoins from the Aave lending pool.
     * Repays any required loan and updates the user's deposit, total deposits, and liquidity index.
     * @param amount The amount of stablecoins to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        UserInfo storage user = users[msg.sender];
        
        require(user.deposit >= amount, "Insufficient deposit"); // Ensure the user has sufficient deposit

        if (user.loan > 0) {
            autoRepay(); // Call autoRepay
        }

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
        autoCompoundGlobal(); // Automatically compound yield AFTER withdrawing, in the event of pool cap being hit

    }

    /**
     * @dev Allows users to borrow a specified amount of stablecoins.
     * Updates the user's loan balance and total loans.
     * @param amount The amount of stablecoins to borrow
     */
    function borrow(uint256 amount) external nonReentrant {
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
            autoRepay(); // Call autoRepay
        }
    }

    /**
    * @dev Allows users to burn NEST tokens to repay their loan and withdraw USDC from the lending pool.
    *
    * Requirements:
    * - The global yield must be compounded before any operations.
    * - The caller must have enough NEST tokens to burn.
    *
    * @param amount The amount of NEST tokens to burn.
    */
    function burnNestForUSDC(uint256 amount) external nonReentrant {
        autoCompoundGlobal(); // Ensure the global yield is compounded before proceeding

        require(balanceOf(msg.sender) >= amount, "Not enough NEST tokens"); // Ensure user has enough NEST tokens to burn
        UserInfo storage user = users[msg.sender];

        uint256 amountToRepayLoan = amount > user.loan ? user.loan : amount;
        uint256 amountToWithdraw = (amount - amountToRepayLoan) / 2; // Calculate the amount of USDC to withdraw for the excess NEST tokens

        if (amountToRepayLoan > 0) {
            _burn(msg.sender, amountToRepayLoan); // Burn the NEST tokens to repay the loan
            user.loan -= amountToRepayLoan;
            totalLoans -= amountToRepayLoan; // Update the total loans
        }

        if (amountToWithdraw > 0) {
            lendingPool.withdraw(address(stablecoin), amountToWithdraw, address(this)); // Withdraw the corresponding amount of USDC from the lending pool
            stablecoin.transfer(msg.sender, amountToWithdraw); // Transfer the USDC to the user
        }
    }

    /**
    * @dev Allows users to automatically repay their loan using accrued yield.
    * Updates the user's loan balance and total loans.
    */
    function autoRepay() public {
        autoCompoundGlobal();
        UserInfo storage user = users[msg.sender];

        uint256 yield = getAccruedYield(msg.sender); // Get the accrued yield for the user

        // Withdraw the accrued yield from Aave
        if (yield > 0) {
            lendingPool.withdraw(address(stablecoin), yield, address(this));
            uint256 fee = (yield * YIELD_FEE_PERCENTAGE) / 10000; // Calculate the fee (1%)
            uint256 yieldAfterFee = yield - fee;

            stablecoin.transfer(owner(), fee); // Transfer the fee to the contract owner

            user.loan -= yieldAfterFee;
            totalLoans -= yieldAfterFee; // Update the total loans

            // Reset the user's accrued yield by updating the user's liquidity index
            user.userLiquidityIndex = globalLiquidityIndex;
            updateUserYield(msg.sender); // Update user's yield after repayment
        }
    }

    /**
     * @dev Automatically compounds the global yield by withdrawing and redepositing funds.
     * Updates the global liquidity index.
     */
    function autoCompoundGlobal() public nonReentrant {
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
            uint256 fee = (yield * YIELD_FEE_PERCENTAGE) / 10000; // Calculate the fee (1%)
            uint256 yieldAfterFee = yield - fee;

            stablecoin.transfer(owner(), fee); // Transfer the fee to the contract owner
            user.deposit += yieldAfterFee; // Increase the user's deposit balance
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

    /**
     * @dev Allows users to perform a flashloan.
     * The user must repay the full amount plus a 0.05% fee within the same transaction.
     * @param amount The amount of USDC to flashloan.
     */
    function flashloan(uint256 amount) external nonReentrant {
        // Calculate the fee (0.05%)
        uint256 fee = (amount * FLASHLOAN_FEE_PERCENTAGE) / 10000;
        uint256 totalRepayment = amount + fee;

        // Withdraw the amount from the lending pool
        lendingPool.withdraw(address(stablecoin), amount, address(this));
        stablecoin.transfer(msg.sender, amount); // Transfer the USDC to the user

        // Call the user's function to execute their logic with the flashloaned funds
        (bool success, ) = msg.sender.call(abi.encodeWithSignature("executeOperation(uint256,uint256)", amount, fee));
        require(success, "Flashloan execution failed");

        // Ensure the user has repaid the full amount plus the fee
        require(stablecoin.balanceOf(address(this)) >= totalRepayment, "Flashloan repayment failed");

        // Re-deposit the total balance of stablecoins
        lendingPool.deposit(address(stablecoin), stablecoin.balanceOf(address(this)), address(this), 0); // Deposit stablecoins into Aave

        emit FlashloanExecuted(msg.sender, amount, fee);
    }

    /**
     * @dev Sets a new value for the collateral ratio.
     * @param newCollatRatio The new collateral ratio (in percentage).
     */
    function setCollatRatio(uint256 newCollatRatio) external onlyOwner {
        COLLAT_RATIO = newCollatRatio;
    }

    /**
     * @dev Sets a new value for the yield fee percentage.
     * @param newYieldFeePercentage The new yield fee percentage (in basis points).
     */
    function setYieldFeePercentage(uint256 newYieldFeePercentage) external onlyOwner {
        YIELD_FEE_PERCENTAGE = newYieldFeePercentage;
    }

    /**
     * @dev Sets a new value for the flashloan fee percentage.
     * @param newFlashloanFeePercentage The new flashloan fee percentage (in basis points).
     */
    function setFlashloanFeePercentage(uint256 newFlashloanFeePercentage) external onlyOwner {
        FLASHLOAN_FEE_PERCENTAGE = newFlashloanFeePercentage;
    }
}
