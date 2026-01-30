// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentWorkEscrow
 * @notice Escrow contract for AgentWork - AI agents hiring AI agents
 * @dev Handles USDC deposits, releases, and refunds for gigs
 */
contract AgentWorkEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // USDC token address (set in constructor)
    IERC20 public immutable usdc;

    // Platform fee (basis points, e.g., 200 = 2%)
    // Kept low intentionally - anti-rent-seeking, maximize agent owner earnings
    uint256 public platformFeeBps = 200;

    // Platform fee recipient
    address public feeRecipient;

    // Escrow states
    enum EscrowState {
        None,       // 0 - Not created
        Funded,     // 1 - USDC deposited, waiting for work
        Released,   // 2 - Work done, funds released to agent
        Refunded,   // 3 - Refunded to poster
        Disputed    // 4 - In dispute (future: add arbitration)
    }

    // Escrow data for each gig
    struct Escrow {
        bytes32 gigId;          // Off-chain gig ID (keccak256 of UUID)
        address poster;         // Agent owner who posted the gig
        address agent;          // Agent owner who will receive payment
        uint256 amount;         // USDC amount (6 decimals)
        uint256 platformFee;    // Fee amount
        EscrowState state;      // Current state
        uint256 createdAt;      // Timestamp
        uint256 deadline;       // Auto-refund deadline (0 = no deadline)
    }

    // Mapping from gigId hash to escrow
    mapping(bytes32 => Escrow) public escrows;

    // Events
    event EscrowCreated(bytes32 indexed gigId, address indexed poster, uint256 amount);
    event AgentAssigned(bytes32 indexed gigId, address indexed agent);
    event EscrowReleased(bytes32 indexed gigId, address indexed agent, uint256 amount, uint256 fee);
    event EscrowRefunded(bytes32 indexed gigId, address indexed poster, uint256 amount);
    event EscrowDisputed(bytes32 indexed gigId, address indexed by);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // Errors
    error InvalidAmount();
    error InvalidAddress();
    error EscrowExists();
    error EscrowNotFound();
    error InvalidState();
    error NotAuthorized();
    error DeadlineNotReached();
    error TransferFailed();

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        if (_usdc == address(0) || _feeRecipient == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Create escrow and deposit USDC for a gig
     * @param gigId The off-chain gig UUID (will be hashed)
     * @param amount USDC amount (6 decimals)
     * @param deadline Optional auto-refund deadline (0 = no deadline)
     */
    function createEscrow(
        string calldata gigId,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        bytes32 gigHash = keccak256(bytes(gigId));
        if (escrows[gigHash].state != EscrowState.None) revert EscrowExists();

        uint256 fee = (amount * platformFeeBps) / 10000;

        escrows[gigHash] = Escrow({
            gigId: gigHash,
            poster: msg.sender,
            agent: address(0),
            amount: amount,
            platformFee: fee,
            state: EscrowState.Funded,
            createdAt: block.timestamp,
            deadline: deadline
        });

        // Transfer USDC from poster to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowCreated(gigHash, msg.sender, amount);
    }

    /**
     * @notice Assign an agent to receive payment when work is done
     * @param gigId The gig UUID
     * @param agent The agent owner's wallet address
     */
    function assignAgent(string calldata gigId, address agent) external {
        if (agent == address(0)) revert InvalidAddress();
        
        bytes32 gigHash = keccak256(bytes(gigId));
        Escrow storage escrow = escrows[gigHash];
        
        if (escrow.state != EscrowState.Funded) revert InvalidState();
        if (escrow.poster != msg.sender) revert NotAuthorized();

        escrow.agent = agent;

        emit AgentAssigned(gigHash, agent);
    }

    /**
     * @notice Release escrow to assigned agent (poster only)
     * @param gigId The gig UUID
     */
    function release(string calldata gigId) external nonReentrant {
        bytes32 gigHash = keccak256(bytes(gigId));
        Escrow storage escrow = escrows[gigHash];

        if (escrow.state != EscrowState.Funded) revert InvalidState();
        if (escrow.poster != msg.sender) revert NotAuthorized();
        if (escrow.agent == address(0)) revert InvalidAddress();

        escrow.state = EscrowState.Released;

        uint256 agentAmount = escrow.amount - escrow.platformFee;

        // Transfer to agent
        usdc.safeTransfer(escrow.agent, agentAmount);
        
        // Transfer fee to platform
        if (escrow.platformFee > 0) {
            usdc.safeTransfer(feeRecipient, escrow.platformFee);
        }

        emit EscrowReleased(gigHash, escrow.agent, agentAmount, escrow.platformFee);
    }

    /**
     * @notice Refund escrow to poster
     * @dev Can only be called by poster if no agent assigned, or after deadline
     * @param gigId The gig UUID
     */
    function refund(string calldata gigId) external nonReentrant {
        bytes32 gigHash = keccak256(bytes(gigId));
        Escrow storage escrow = escrows[gigHash];

        if (escrow.state != EscrowState.Funded) revert InvalidState();
        if (escrow.poster != msg.sender) revert NotAuthorized();

        // Can refund if: no agent assigned, OR deadline passed
        bool canRefund = escrow.agent == address(0) || 
            (escrow.deadline > 0 && block.timestamp >= escrow.deadline);
        
        if (!canRefund) revert DeadlineNotReached();

        escrow.state = EscrowState.Refunded;

        // Full refund (no fee taken on refunds)
        usdc.safeTransfer(escrow.poster, escrow.amount);

        emit EscrowRefunded(gigHash, escrow.poster, escrow.amount);
    }

    /**
     * @notice Mark escrow as disputed (future: add arbitration)
     * @param gigId The gig UUID
     */
    function dispute(string calldata gigId) external {
        bytes32 gigHash = keccak256(bytes(gigId));
        Escrow storage escrow = escrows[gigHash];

        if (escrow.state != EscrowState.Funded) revert InvalidState();
        if (escrow.poster != msg.sender && escrow.agent != msg.sender) revert NotAuthorized();

        escrow.state = EscrowState.Disputed;

        emit EscrowDisputed(gigHash, msg.sender);
    }

    /**
     * @notice Resolve dispute (owner only - future: add proper arbitration)
     * @param gigId The gig UUID
     * @param releaseToAgent True = release to agent, False = refund to poster
     */
    function resolveDispute(string calldata gigId, bool releaseToAgent) external onlyOwner nonReentrant {
        bytes32 gigHash = keccak256(bytes(gigId));
        Escrow storage escrow = escrows[gigHash];

        if (escrow.state != EscrowState.Disputed) revert InvalidState();

        if (releaseToAgent && escrow.agent != address(0)) {
            escrow.state = EscrowState.Released;
            uint256 agentAmount = escrow.amount - escrow.platformFee;
            usdc.safeTransfer(escrow.agent, agentAmount);
            if (escrow.platformFee > 0) {
                usdc.safeTransfer(feeRecipient, escrow.platformFee);
            }
            emit EscrowReleased(gigHash, escrow.agent, agentAmount, escrow.platformFee);
        } else {
            escrow.state = EscrowState.Refunded;
            usdc.safeTransfer(escrow.poster, escrow.amount);
            emit EscrowRefunded(gigHash, escrow.poster, escrow.amount);
        }
    }

    // ============ View Functions ============

    function getEscrow(string calldata gigId) external view returns (Escrow memory) {
        return escrows[keccak256(bytes(gigId))];
    }

    function getEscrowState(string calldata gigId) external view returns (EscrowState) {
        return escrows[keccak256(bytes(gigId))].state;
    }

    // ============ Admin Functions ============

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        emit PlatformFeeUpdated(platformFeeBps, _feeBps);
        platformFeeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert InvalidAddress();
        emit FeeRecipientUpdated(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    // Emergency withdrawal (owner only, for stuck funds)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
