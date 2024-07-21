let userAddress = null;
let web3 = null;

document.getElementById('connect-button').addEventListener('click', async () => {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            web3 = new Web3(window.ethereum);
            userAddress = accounts[0];
            document.getElementById('wallet-address').innerText = `Connected: ${userAddress}`;
            document.getElementById('connect-button').innerText = 'Disconnect';

            const contractAddress = '0x3Ba107B605f88106B8E62FA1F0c95985c4f51d84';
            const contractABI = [
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "_stablecoin",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "_lendingPool",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "_aToken",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "constructor"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "spender",
                            "type": "address"
                        },
                        {
                            "internalType": "uint256",
                            "name": "allowance",
                            "type": "uint256"
                        },
                        {
                            "internalType": "uint256",
                            "name": "needed",
                            "type": "uint256"
                        }
                    ],
                    "name": "ERC20InsufficientAllowance",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "sender",
                            "type": "address"
                        },
                        {
                            "internalType": "uint256",
                            "name": "balance",
                            "type": "uint256"
                        },
                        {
                            "internalType": "uint256",
                            "name": "needed",
                            "type": "uint256"
                        }
                    ],
                    "name": "ERC20InsufficientBalance",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "approver",
                            "type": "address"
                        }
                    ],
                    "name": "ERC20InvalidApprover",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "receiver",
                            "type": "address"
                        }
                    ],
                    "name": "ERC20InvalidReceiver",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "sender",
                            "type": "address"
                        }
                    ],
                    "name": "ERC20InvalidSender",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "spender",
                            "type": "address"
                        }
                    ],
                    "name": "ERC20InvalidSpender",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "owner",
                            "type": "address"
                        }
                    ],
                    "name": "OwnableInvalidOwner",
                    "type": "error"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "account",
                            "type": "address"
                        }
                    ],
                    "name": "OwnableUnauthorizedAccount",
                    "type": "error"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "owner",
                            "type": "address"
                        },
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "spender",
                            "type": "address"
                        },
                        {
                            "indexed": false,
                            "internalType": "uint256",
                            "name": "value",
                            "type": "uint256"
                        }
                    ],
                    "name": "Approval",
                    "type": "event"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "spender",
                            "type": "address"
                        },
                        {
                            "internalType": "uint256",
                            "name": "value",
                            "type": "uint256"
                        }
                    ],
                    "name": "approve",
                    "outputs": [
                        {
                            "internalType": "bool",
                            "name": "",
                            "type": "bool"
                        }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "autoCompoundGlobal",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "autoRepay",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "uint256",
                            "name": "amount",
                            "type": "uint256"
                        }
                    ],
                    "name": "borrow",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "uint256",
                            "name": "amount",
                            "type": "uint256"
                        }
                    ],
                    "name": "deposit",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": false,
                            "internalType": "string",
                            "name": "reason",
                            "type": "string"
                        }
                    ],
                    "name": "InitializationFailed",
                    "type": "event"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "previousOwner",
                            "type": "address"
                        },
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "newOwner",
                            "type": "address"
                        }
                    ],
                    "name": "OwnershipTransferred",
                    "type": "event"
                },
                {
                    "inputs": [],
                    "name": "renounceOwnership",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": false,
                            "internalType": "uint128",
                            "name": "liquidityIndex",
                            "type": "uint128"
                        }
                    ],
                    "name": "ReserveDataRetrieved",
                    "type": "event"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "to",
                            "type": "address"
                        },
                        {
                            "internalType": "uint256",
                            "name": "value",
                            "type": "uint256"
                        }
                    ],
                    "name": "transfer",
                    "outputs": [
                        {
                            "internalType": "bool",
                            "name": "",
                            "type": "bool"
                        }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "from",
                            "type": "address"
                        },
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "to",
                            "type": "address"
                        },
                        {
                            "indexed": false,
                            "internalType": "uint256",
                            "name": "value",
                            "type": "uint256"
                        }
                    ],
                    "name": "Transfer",
                    "type": "event"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "from",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "to",
                            "type": "address"
                        },
                        {
                            "internalType": "uint256",
                            "name": "value",
                            "type": "uint256"
                        }
                    ],
                    "name": "transferFrom",
                    "outputs": [
                        {
                            "internalType": "bool",
                            "name": "",
                            "type": "bool"
                        }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "newOwner",
                            "type": "address"
                        }
                    ],
                    "name": "transferOwnership",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "uint256",
                            "name": "amount",
                            "type": "uint256"
                        }
                    ],
                    "name": "withdraw",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "owner",
                            "type": "address"
                        },
                        {
                            "internalType": "address",
                            "name": "spender",
                            "type": "address"
                        }
                    ],
                    "name": "allowance",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "aToken",
                    "outputs": [
                        {
                            "internalType": "contract IAToken",
                            "name": "",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "account",
                            "type": "address"
                        }
                    ],
                    "name": "balanceOf",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "COLLAT_RATIO",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "decimals",
                    "outputs": [
                        {
                            "internalType": "uint8",
                            "name": "",
                            "type": "uint8"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "FEE_PERCENTAGE",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "userAddr",
                            "type": "address"
                        }
                    ],
                    "name": "getAccruedYield",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "userAddr",
                            "type": "address"
                        }
                    ],
                    "name": "getDeposit",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "userAddr",
                            "type": "address"
                        }
                    ],
                    "name": "getLoan",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "getTotalDeposits",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "getTotalLoans",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "globalLiquidityIndex",
                    "outputs": [
                        {
                            "internalType": "uint128",
                            "name": "",
                            "type": "uint128"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "lastCompoundTime",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "lendingPool",
                    "outputs": [
                        {
                            "internalType": "contract ILendingPool",
                            "name": "",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "name",
                    "outputs": [
                        {
                            "internalType": "string",
                            "name": "",
                            "type": "string"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "owner",
                    "outputs": [
                        {
                            "internalType": "address",
                            "name": "",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "stablecoin",
                    "outputs": [
                        {
                            "internalType": "contract IERC20",
                            "name": "",
                            "type": "address"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "symbol",
                    "outputs": [
                        {
                            "internalType": "string",
                            "name": "",
                            "type": "string"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "totalDeposits",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "totalLoans",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "totalSupply",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "",
                            "type": "address"
                        }
                    ],
                    "name": "users",
                    "outputs": [
                        {
                            "internalType": "uint256",
                            "name": "deposit",
                            "type": "uint256"
                        },
                        {
                            "internalType": "uint256",
                            "name": "loan",
                            "type": "uint256"
                        },
                        {
                            "internalType": "uint128",
                            "name": "userLiquidityIndex",
                            "type": "uint128"
                        }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];
            const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
            const usdcDecimals = 6;
            const usdcABI = [
                {
                    "constant": true,
                    "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
                    "name": "allowance",
                    "outputs": [{ "name": "", "type": "uint256" }],
                    "payable": false,
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }],
                    "name": "approve",
                    "outputs": [{ "name": "", "type": "bool" }],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ];

            const contract = new web3.eth.Contract(contractABI, contractAddress);
            const usdcContract = new web3.eth.Contract(usdcABI, usdcAddress);

            async function updateAllowance() {
                if (!userAddress) {
                    document.getElementById('approve-button').style.display = 'none';
                    return;
                }

                const allowance = await usdcContract.methods.allowance(userAddress, contractAddress).call();
                const depositAmount = document.getElementById('deposit-amount').value * (10 ** usdcDecimals);

                if (parseInt(allowance) >= depositAmount) {
                    document.getElementById('approve-button').style.display = 'none';
                } else {
                    document.getElementById('approve-button').style.display = 'inline-block';
                }
            }

            document.getElementById('approve-button').addEventListener('click', async () => {
                const depositAmount = document.getElementById('deposit-amount').value * (10 ** usdcDecimals);
                await usdcContract.methods.approve(contractAddress, depositAmount).send({ from: userAddress });
                updateAllowance();
            });

            document.getElementById('approve-button').addEventListener('click', async () => {
                const depositAmount = document.getElementById('deposit-amount').value * (10 ** usdcDecimals);
                await usdcContract.methods.approve(contractAddress, depositAmount).send({ from: userAddress });
                updateAllowance();
            });

            document.getElementById('deposit-button').addEventListener('click', async () => {
                const depositAmount = document.getElementById('deposit-amount').value * (10 ** usdcDecimals);
                await contract.methods.deposit(depositAmount).send({ from: userAddress });
            });

            document.getElementById('withdraw-button').addEventListener('click', async () => {
                const withdrawAmount = document.getElementById('withdraw-amount').value * (10 ** usdcDecimals);
                await contract.methods.withdraw(withdrawAmount).send({ from: userAddress });
            });

            document.getElementById('borrow-button').addEventListener('click', async () => {
                const borrowAmount = document.getElementById('borrow-amount').value * (10 ** usdcDecimals);
                await contract.methods.borrow(borrowAmount).send({ from: userAddress });
            });

            document.getElementById('connect-button').addEventListener('click', () => {
                window.location.reload(); // Reload the page to disconnect
            });

            await updateAllowance();

            const aTokenAddress = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB';
            const lendingPoolAddress = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5';

            const aToken = new web3.eth.Contract([{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}], aTokenAddress);
            const lendingPool = new web3.eth.Contract([
                {
                    "constant": true,
                    "inputs": [{ "name": "_reserve", "type": "address" }],
                    "name": "getReserveData",
                    "outputs": [
                        { "name": "configuration", "type": "uint256" },
                        { "name": "liquidityIndex", "type": "uint128" },
                        { "name": "variableBorrowIndex", "type": "uint128" },
                        { "name": "currentLiquidityRate", "type": "uint128" },
                        { "name": "currentVariableBorrowRate", "type": "uint128" },
                        { "name": "currentStableBorrowRate", "type": "uint128" },
                        { "name": "lastUpdateTimestamp", "type": "uint40" },
                        { "name": "id", "type": "uint16" },
                        { "name": "aTokenAddress", "type": "address" },
                        { "name": "stableDebtTokenAddress", "type": "address" },
                        { "name": "variableDebtTokenAddress", "type": "address" },
                        { "name": "interestRateStrategyAddress", "type": "address" }
                    ],
                    "payable": false,
                    "stateMutability": "view",
                    "type": "function"
                }
            ], lendingPoolAddress);

            const aTokenBalance = await aToken.methods.balanceOf(contractAddress).call();
            const reserveData = await lendingPool.methods.getReserveData(usdcAddress).call();
            const totalDeposits = await contract.methods.getTotalDeposits().call();

            const userDeposits = await contract.methods.getDeposit(userAddress).call();
            const userLoans = await contract.methods.getLoan(userAddress).call();

            document.getElementById('total-deposits').innerText = (totalDeposits / (10 ** usdcDecimals)).toFixed(6);
            document.getElementById('total-loans').innerText = web3.utils.fromWei(userLoans, 'mwei');
            document.getElementById('user-deposits').innerText = web3.utils.fromWei(userDeposits, 'mwei');
            document.getElementById('user-loans').innerText = web3.utils.fromWei(userLoans, 'mwei');
            
            const apr = await estimateAPY(lendingPool, usdcAddress);
            document.getElementById('estimated-apr').innerText = apr.toFixed(2);

        } catch (error) {
            console.error(error);
        }
    } else {
        alert('Please install MetaMask to use this feature.');
        document.getElementById('approve-button').style.display = 'none';
    }
});

async function updateAllowance() {
    if (!userAddress) {
        document.getElementById('approve-button').style.display = 'none';
        return;
    }
}

async function estimateAPY(lendingPool, asset) {
    const RAY = 10 ** 27;
    const SECONDS_PER_YEAR = 31536000;

    try {
        console.log("Fetching reserve data for asset:", asset);

        // Fetch the reserve data for the asset
        const reserveData = await lendingPool.methods.getReserveData(asset).call();
        console.log("Fetched reserve data:", reserveData);

        const liquidityRate = reserveData.currentLiquidityRate;
        console.log("Liquidity rate (in RAY):", liquidityRate);

        // Convert from RAY format to decimal APR
        const depositAPR = liquidityRate / RAY / 10; // This is fucking wrong and terrible but it works
        console.log("Converted deposit APR (decimal):", depositAPR);

        // Return APY as a percentage with two decimal places
        const supplyAPRPercentage = (depositAPR * 100);
        console.log("Supply APR (percentage):", supplyAPRPercentage);

        return supplyAPRPercentage;
    } catch (error) {
        console.error("Error fetching reserve data:", error);
        return "0.00"; // Return a default value in case of an error
    }
}

document.getElementById('deposit-amount').addEventListener('input', updateAllowance);

document.addEventListener('DOMContentLoaded', updateAllowance);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('deposit-amount').addEventListener('input', updateAllowance);

    const treeTopContainer = document.querySelector('.tree-top-container');
    const treeTopImageSrc = './treetop.png'; // Adjust the path to your treetop image

    for (let i = 0; i < 30; i++) { // Number of treetops to create
        const img = document.createElement('img');
        img.src = treeTopImageSrc;
        img.classList.add('tree-top');

        // Randomize position, size, and rotation
        img.style.left = `${Math.random() * 100}%`;
        img.style.width = `${150 + Math.random() * 100}px`;
        img.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;

        treeTopContainer.appendChild(img);
    }

    const birdAudio = document.getElementById('bird-audio');
    const muteButton = document.getElementById('mute-button');
    let isMuted = false;

    // Play audio on first user interaction
    const playAudio = () => {
        birdAudio.play();
        document.removeEventListener('click', playAudio);
    };

    document.addEventListener('click', playAudio);

    // Toggle mute on button click
    muteButton.addEventListener('click', () => {
        isMuted = !isMuted;
        birdAudio.muted = isMuted;
        muteButton.textContent = isMuted ? '🔇' : '🔊';
    });
});
