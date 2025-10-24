// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

/**
 * @title AaveVault
 * @notice A vault contract that accepts ETH deposits and supplies them to Aave V3 to earn yield
 * @dev Users can deposit ETH, anyone can trigger supply to Aave, and users can withdraw their proportional share
 */
contract AaveVault {
    // Aave V3 Pool contract
    IPool public immutable aavePool;

    // WETH token contract
    IWETH public immutable weth;

    // aWETH token (Aave interest-bearing WETH)
    IERC20 public immutable aToken;

    // Track individual user deposits
    mapping(address => uint256) public userDeposits;

    // Track total deposits made by all users
    uint256 public totalDeposits;

    // Events
    event Deposited(address indexed user, uint256 amount);
    event SuppliedToAave(uint256 amount, address indexed caller);
    event Withdrawn(address indexed user, uint256 depositAmount, uint256 totalAmount);

    /**
     * @notice Constructor to initialize the vault with Aave and WETH addresses
     * @param _aavePool Address of the Aave V3 Pool contract
     * @param _weth Address of the WETH token
     * @param _aToken Address of the aToken (aWETH)
     */
    constructor(address _aavePool, address _weth, address _aToken) {
        require(_aavePool != address(0), "Invalid Aave Pool address");
        require(_weth != address(0), "Invalid WETH address");
        require(_aToken != address(0), "Invalid aToken address");

        aavePool = IPool(_aavePool);
        weth = IWETH(_weth);
        aToken = IERC20(_aToken);
    }

    /**
     * @notice Deposit ETH into the vault
     * @dev ETH is held in the contract until supplyToAave is called
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit more than 0");

        userDeposits[msg.sender] += msg.value;
        totalDeposits += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Supply all available ETH in the vault to Aave
     * @dev Can be called by anyone. Wraps ETH to WETH and supplies to Aave Pool
     */
    function supplyToAave() external {
        uint256 ethBalance = address(this).balance;
        require(ethBalance > 0, "No ETH to supply");

        // Wrap ETH to WETH
        weth.deposit{ value: ethBalance }();

        // Approve Aave Pool to spend WETH
        weth.approve(address(aavePool), ethBalance);

        // Supply WETH to Aave (contract receives aWETH tokens)
        aavePool.supply(address(weth), ethBalance, address(this), 0);

        emit SuppliedToAave(ethBalance, msg.sender);
    }

    /**
     * @notice Withdraw user's proportional share of the vault
     * @param amount The amount of original deposit to withdraw
     * @dev Withdraws proportional share including earned interest from Aave
     * @dev Returns WETH to user if funds are in Aave, ETH if funds are in contract
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Must withdraw more than 0");
        require(userDeposits[msg.sender] >= amount, "Insufficient balance");

        // Calculate user's proportional share of total vault value
        uint256 totalVaultValue = getTotalVaultValue();
        uint256 userShare = (totalVaultValue * amount) / totalDeposits;

        // Update user deposits and total deposits
        userDeposits[msg.sender] -= amount;
        totalDeposits -= amount;

        // Check if we need to withdraw from Aave
        uint256 ethBalance = address(this).balance;
        uint256 aaveBalance = aToken.balanceOf(address(this));
        uint256 wethToSend = 0;
        uint256 ethToSend = 0;

        if (userShare > ethBalance && aaveBalance > 0) {
            // Need to withdraw from Aave - this gives us WETH
            uint256 amountToWithdraw = userShare - ethBalance;

            // Withdraw WETH from Aave
            uint256 withdrawn = aavePool.withdraw(address(weth), amountToWithdraw, address(this));

            // Send WETH directly to user (Optimism WETH doesn't support unwrap)
            wethToSend = withdrawn;
            ethToSend = ethBalance;
        } else {
            // We have enough ETH in the contract
            ethToSend = userShare;
        }

        // Transfer WETH if any
        if (wethToSend > 0) {
            require(weth.transfer(msg.sender, wethToSend), "WETH transfer failed");
        }

        // Transfer ETH if any
        if (ethToSend > 0) {
            (bool success, ) = msg.sender.call{ value: ethToSend }("");
            require(success, "ETH transfer failed");
        }

        emit Withdrawn(msg.sender, amount, userShare);
    }

    /**
     * @notice Get the total value of the vault (ETH + aToken balance)
     * @return Total vault value in wei
     */
    function getTotalVaultValue() public view returns (uint256) {
        uint256 ethBalance = address(this).balance;
        uint256 aaveBalance = aToken.balanceOf(address(this));
        return ethBalance + aaveBalance;
    }

    /**
     * @notice Get user's current value including earned interest
     * @param user Address of the user
     * @return User's total value in wei
     */
    function getUserValue(address user) external view returns (uint256) {
        if (totalDeposits == 0) return 0;

        uint256 totalVaultValue = getTotalVaultValue();
        return (totalVaultValue * userDeposits[user]) / totalDeposits;
    }

    /**
     * @notice Get the amount of interest earned by a user
     * @param user Address of the user
     * @return Interest earned in wei
     */
    function getUserInterest(address user) external view returns (uint256) {
        if (totalDeposits == 0) return 0;

        uint256 totalVaultValue = getTotalVaultValue();
        uint256 userTotalValue = (totalVaultValue * userDeposits[user]) / totalDeposits;

        if (userTotalValue > userDeposits[user]) {
            return userTotalValue - userDeposits[user];
        }
        return 0;
    }

    /**
     * @notice Get the balance of ETH held in the vault (not yet supplied to Aave)
     * @return ETH balance in wei
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get the balance of aToken (supplied to Aave)
     * @return aToken balance
     */
    function getAaveBalance() external view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
