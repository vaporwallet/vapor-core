const { ethers } = require("hardhat")
const { expect } = require("chai")
const { toEther, fromEther } = require("./helper")

describe("#forwarderWithMock", () => {

    let controller
    let vault
    let forwarder
    let mockDepositPool

    let alice
    let bob
    let charlie
    let dave

    before(async () => {

        [alice, bob, charlie, dave] = await ethers.getSigners()

        const MultiSigController = await ethers.getContractFactory("MultiSigController")
        const Vault = await ethers.getContractFactory("Vault")
        const Forwarder = await ethers.getContractFactory("Forwarder")

        controller = await MultiSigController.deploy([alice.address, bob.address, charlie.address, dave.address], 2)
        vault = await Vault.deploy(1, controller.target)
        forwarder = await Forwarder.deploy(controller.target, vault.target)

    })

    it("should register all protocol addresses success", async function () {

        // deploy Mock protocol
        const MockDepositPool = await ethers.getContractFactory("MockDepositPool")
        mockDepositPool = await MockDepositPool.deploy()

        await forwarder.register(0, mockDepositPool.target)

        expect( await forwarder.registry(0)).to.equal(mockDepositPool.target)
    })

    it("should deposit 10 ETH to the vault and then stake success", async function () {
        
        // add supported contract
        await controller.addContract(forwarder.target)

        // deposit 10 ETH
        await vault.connect(alice).depositWithETH({ value: toEther(10) })

        // request stake
        await forwarder.requestStake(0, toEther(10))

        // signing
        await controller.connect(alice).confirmRequest(0)
        await controller.connect(bob).confirmRequest(0)

        await controller.connect(charlie).executeRequest(0)

        // checking mockETH balance
        const tokenAddress = await mockDepositPool.rTokenAddress()
        const token = await ethers.getContractAt("MockRToken", tokenAddress);

        expect( await token.balanceOf(vault.target)).to.equal(toEther(10))

    })

    it("should unstake success", async function () {
        
        // approve mockETH to spend
        const tokenAddress = await mockDepositPool.rTokenAddress()

        await vault.approve(tokenAddress, mockDepositPool.target)

        // require unstake 
        await forwarder.requestUnstake(0, tokenAddress, toEther(10) )

        // signing
        await controller.connect(alice).confirmRequest(1)
        await controller.connect(bob).confirmRequest(1)

        // checking
        const beforeBalance = await ethers.provider.getBalance(vault.target)

        await controller.connect(charlie).executeRequest(1)

        const afterBalance = await ethers.provider.getBalance(vault.target)
        expect( afterBalance-beforeBalance ).to.equal(toEther(10))
    })

})