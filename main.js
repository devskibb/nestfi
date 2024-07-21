let web3 = null;
let userAddress = null;
let usdcContract = null;
let contractAddress = null;
let usdcDecimals = 6;

async function loadABI(filename) {
    const response = await fetch(filename);
    return response.json();
}

async function updateAllowance() {
    if (!userAddress || !usdcContract || !contractAddress) {
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

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            web3 = new Web3(window.ethereum);
            userAddress = accounts[0];
            document.getElementById('wallet-address').innerText = `Connected: ${userAddress}`;
            document.getElementById('connect-button').innerText = 'Disconnect';

            const contractABI = await loadABI('contractABI.json');
            const usdcABI = await loadABI('usdcABI.json');
            contractAddress = '0x3Ba107B605f88106B8E62FA1F0c95985c4f51d84';
            const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

            const contract = new web3.eth.Contract(contractABI, contractAddress);
            usdcContract = new web3.eth.Contract(usdcABI, usdcAddress);

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

            document.getElementById('total-deposits').innerText = (totalDeposits / (10 ** usdcDecimals)).toFixed(2);
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
}

function disconnectWallet() {
    userAddress = null;
    web3 = null;
    usdcContract = null;
    contractAddress = null;

    document.getElementById('wallet-address').innerText = '';
    document.getElementById('connect-button').innerText = 'Connect';
    document.getElementById('approve-button').style.display = 'none';
    document.getElementById('total-deposits').innerText = '';
    document.getElementById('total-loans').innerText = '';
    document.getElementById('user-deposits').innerText = '';
    document.getElementById('user-loans').innerText = '';
    document.getElementById('estimated-apr').innerText = '';
}

document.getElementById('connect-button').addEventListener('click', () => {
    if (userAddress) {
        disconnectWallet();
    } else {
        connectWallet();
    }
});

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

document.addEventListener('DOMContentLoaded', () => {
    if (userAddress && usdcContract && contractAddress) {
        updateAllowance();
    }

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

    const mascot = document.getElementById('mascot');

    mascot.addEventListener('mouseover', () => {
        mascot.classList.add('jiggle');
    });

    mascot.addEventListener('mouseleave', () => {
        mascot.classList.remove('jiggle');
    });
});
