// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTCollectionERC20 is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    IERC20 public paymentToken;
    uint256 public mintPrice;
    uint256 public maxSupply;
    string private _baseTokenURI;
    bool public mintingPaused;
    uint256 public maxMintsPerAddress;

    mapping(address => uint256) public mintedByAddress;

    event NFTMinted(address indexed minter, uint256 indexed tokenId, string tokenURI);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);
    event BaseURIUpdated(string newBaseURI);
    event MintingPausedToggled(bool isPaused);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        address _paymentToken,
        uint256 _mintPrice,
        uint256 _maxSupply,
        string memory baseTokenURI
    ) ERC721(name, symbol) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_maxSupply > 0, "Max supply must be > 0");

        paymentToken = IERC20(_paymentToken);
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        _baseTokenURI = baseTokenURI;
        mintingPaused = false;
        maxMintsPerAddress = 0;
    }

    function mint(string memory metadataURI) external nonReentrant {
        require(!mintingPaused, "Minting paused");
        require(_tokenIdCounter.current() < maxSupply, "Max supply reached");
        require(
            maxMintsPerAddress == 0 || mintedByAddress[msg.sender] < maxMintsPerAddress,
            "Minting limit reached"
        );

        require(paymentToken.transferFrom(msg.sender, address(this), mintPrice), "Payment failed");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        mintedByAddress[msg.sender]++;
        emit NFTMinted(msg.sender, tokenId, metadataURI);
    }

    function batchMint(string[] memory metadataURIs) external nonReentrant {
        require(!mintingPaused, "Minting paused");
        require(metadataURIs.length > 0, "Empty array");
        require(_tokenIdCounter.current() + metadataURIs.length <= maxSupply, "Exceeds supply");
        require(
            maxMintsPerAddress == 0 ||
                mintedByAddress[msg.sender] + metadataURIs.length <= maxMintsPerAddress,
            "Mint limit reached"
        );

        uint256 totalCost = mintPrice * metadataURIs.length;
        require(paymentToken.transferFrom(msg.sender, address(this), totalCost), "Payment failed");

        for (uint256 i = 0; i < metadataURIs.length; i++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, metadataURIs[i]);
            emit NFTMinted(msg.sender, tokenId, metadataURIs[i]);
        }

        mintedByAddress[msg.sender] += metadataURIs.length;
    }

    function ownerMint(address to, string memory metadataURI) external onlyOwner {
        require(_tokenIdCounter.current() < maxSupply, "Max supply reached");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit NFTMinted(to, tokenId, metadataURI);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 old = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(old, newPrice);
    }

    function setPaymentToken(address newPaymentToken) external onlyOwner {
        require(newPaymentToken != address(0), "Invalid token");
        address old = address(paymentToken);
        paymentToken = IERC20(newPaymentToken);
        emit PaymentTokenUpdated(old, newPaymentToken);
    }

    function setBaseURI(string memory baseTokenURI) external onlyOwner {
        _baseTokenURI = baseTokenURI;
        emit BaseURIUpdated(baseTokenURI);
    }

    function toggleMintingPause() external onlyOwner {
        mintingPaused = !mintingPaused;
        emit MintingPausedToggled(mintingPaused);
    }

    function setMaxMintsPerAddress(uint256 max) external onlyOwner {
        maxMintsPerAddress = max;
    }

    function withdrawTokens(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        paymentToken.transfer(to, balance);
        emit FundsWithdrawn(address(paymentToken), to, balance);
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function remainingSupply() external view returns (uint256) {
        return maxSupply - _tokenIdCounter.current();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
