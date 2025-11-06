// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * GoldStableChainlink.sol (Student Exercise)
 * ERC20 stable token pegged to 1oz of gold (XAU/USD).
 * Oracle: Chainlink Price Feed (XAU/USD)
 * Collateral: ERC20 (e.g. USDC)
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

contract GoldStableChainlink is ERC20, Ownable, ReentrancyGuard {
    IERC20 public collateral;
    AggregatorV3Interface public priceFeed;

    uint16 public collateralRatioPct = 120;  // 120%
    uint16 public mintFeeBps = 50;           // 0.5%
    uint16 public redeemFeeBps = 50;         // 0.5%
    uint256 public constant BPS_DENOM = 10000;

    event Minted(address indexed user, uint256 amountGOF, uint256 collateralDeposited);
    event Redeemed(address indexed user, uint256 amountGOF, uint256 collateralReturned);
    event OracleUpdated(address oldFeed, address newFeed);

    constructor(address _collateral, address _priceFeed)
        ERC20("Gold Stable (Chainlink)", "GOF")
        Ownable(msg.sender)
    {
        collateral = IERC20(_collateral);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /// @notice Get gold price from Chainlink, normalized to 18 decimals
    function getGoldPrice() public view returns (uint256 price18, uint256 updatedAt) {
        (, int256 answer, , uint256 updated, ) = priceFeed.latestRoundData();
        uint8 decimalsFeed = priceFeed.decimals();

        require(answer > 0, "Oracle price invalid");

        // Normalisation en 18 décimales
        price18 = uint256(answer) * (10 ** (18 - decimalsFeed));
        updatedAt = updated;
    }



    /// @notice Calculate how much collateral is needed to mint `amountGOF`
    function requiredCollateralForMint(uint256 amountGOF) public view returns (uint256 requiredCollateral) {
        (uint256 goldPrice18, ) = getGoldPrice(); // prix en 18 décimales
        uint256 collateralRatio = uint256(collateralRatioPct) * 1e16; // convertit 120% → 1.20 * 1e18

        // Valeur de amountGOF * prix, puis appliquer ratio
        uint256 collateralValue18 = (amountGOF * goldPrice18) / 1e18;
        uint256 collateralWithRatio = (collateralValue18 * collateralRatio) / 1e18;

        // Convertir en décimales du token collatéral (USDC = 6 décimales)
        uint8 decimalsCollateral = ERC20(address(collateral)).decimals();
        requiredCollateral = collateralWithRatio / (10 ** (18 - decimalsCollateral));
    }



    function mintWithCollateral(uint256 amountGOF) external nonReentrant {
        uint256 required = requiredCollateralForMint(amountGOF);

        // Prendre le collateral de l'utilisateur
        require(collateral.transferFrom(msg.sender, address(this), required), "transfer failed");

        // Appliquer la fee de mint (ex : 0.5%)
        uint256 fee = (amountGOF * mintFeeBps) / BPS_DENOM;
        uint256 amountAfterFee = amountGOF - fee;

        // Mint du GOF
        _mint(msg.sender, amountAfterFee);

        emit Minted(msg.sender, amountAfterFee, required);
    }



    function redeem(uint256 amountGOF) external nonReentrant {
        (uint256 goldPrice18, ) = getGoldPrice();
        uint256 collateralRatio = uint256(collateralRatioPct) * 1e16;

        // Valeur or → collatéral
        uint256 value18 = (amountGOF * goldPrice18) / 1e18;
        uint256 collateralValue18 = (value18 * collateralRatio) / 1e18;

        uint8 decimalsCollateral = ERC20(address(collateral)).decimals();
        uint256 collateralAmount = collateralValue18 / (10 ** (18 - decimalsCollateral));

        // Fee
        uint256 fee = (collateralAmount * redeemFeeBps) / BPS_DENOM;
        uint256 collateralAfterFee = collateralAmount - fee;

        _burn(msg.sender, amountGOF);
        require(collateral.transfer(msg.sender, collateralAfterFee), "transfer failed");

        emit Redeemed(msg.sender, amountGOF, collateralAfterFee);
    }



    // ADMIN FUNCTIONS
    function setPriceFeed(address newFeed) external onlyOwner {
        address old = address(priceFeed);
        priceFeed = AggregatorV3Interface(newFeed);
        emit OracleUpdated(old, newFeed);
    }

    function setCollateralRatio(uint16 newPct) external onlyOwner {
        require(newPct >= 100, "ratio < 100%");
        collateralRatioPct = newPct;
    }

    function setFees(uint16 _mintFeeBps, uint16 _redeemFeeBps) external onlyOwner {
        require(_mintFeeBps <= 1000 && _redeemFeeBps <= 1000, "fees too high");
        mintFeeBps = _mintFeeBps;
        redeemFeeBps = _redeemFeeBps;
    }

    function emergencyWithdrawCollateral(address to, uint256 amount) external onlyOwner {
        require(collateral.transfer(to, amount), "withdraw failed");
    }
}
