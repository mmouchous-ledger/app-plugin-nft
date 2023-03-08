import Zemu from "@zondax/zemu";
import Eth from "@ledgerhq/hw-app-eth";
import { generate_plugin_config } from "./generate_plugin_config";
import { parseEther, parseUnits, RLP } from "ethers/lib/utils";
import { ethers } from "ethers";
import ledgerService from "@ledgerhq/hw-app-eth/lib/services/ledger"

const transactionUploadDelay = 60000;

const sim_options_generic = {
    logging: true,
    startDelay: 15000,
    startText: "Ready",
    approveKeyword: "APPROVE",
    rejectKeyword: "REJECT",
    custom: "",
    caseSensitive: false,
    sdk: ""
};

const Resolve = require("path").resolve;

const NANOS_ETH_PATH = Resolve("elfs/ethereum_nanos.elf");
const NANOSP_ETH_PATH = Resolve("elfs/ethereum_nanosp.elf");
const NANOX_ETH_PATH = Resolve("elfs/ethereum_nanox.elf");

const NANOS_PLUGIN_PATH = Resolve("elfs/plugin_nanos.elf");
const NANOSP_PLUGIN_PATH = Resolve("elfs/plugin_nanosp.elf");
const NANOX_PLUGIN_PATH = Resolve("elfs/plugin_nanox.elf");

const NANOS_PLUGIN = { "LedgerNFT": NANOS_PLUGIN_PATH };
const NANOSP_PLUGIN = { "LedgerNFT": NANOSP_PLUGIN_PATH };
const NANOX_PLUGIN = { "LedgerNFT": NANOX_PLUGIN_PATH };


const RANDOM_ADDRESS = "0xaaaabbbbccccddddeeeeffffgggghhhhiiiijjjj";

let genericTx = {
    nonce: Number(0),
    gasLimit: Number(21000),
    gasPrice: parseUnits("1", "gwei"),
    value: parseEther("1"),
    chainId: 1,
    to: RANDOM_ADDRESS,
    data: null,
};


let config;

const TIMEOUT = 1000000;
jest.setTimeout(TIMEOUT);

/**
 * Generates a serializedTransaction from a rawHexTransaction copy pasted from etherscan.
 * @param {string} rawTx Raw transaction
 * @returns {string} serializedTx
 */
function txFromEtherscan(rawTx) {
    // Remove 0x prefix
    rawTx = rawTx.slice(2);

    let txType = rawTx.slice(0, 2);
    if (txType == "02" || txType == "01") {
        // Remove "02" prefix
        rawTx = rawTx.slice(2);
    } else {
        txType = "";
    }

    let decoded = RLP.decode("0x" + rawTx);
    if (txType != "") {
        decoded = decoded.slice(0, decoded.length - 3); // remove v, r, s
    } else {
        decoded[decoded.length - 1] = "0x"; // empty
        decoded[decoded.length - 2] = "0x"; // empty
        decoded[decoded.length - 3] = "0x01"; // chainID 1
    }

    // Encode back the data, drop the '0x' prefix
    let encoded = RLP.encode(decoded).slice(2);

    // Don't forget to prepend the txtype
    return txType + encoded;
}

/**
  * Emulation of the device using zemu
  * @param {string} device name of the device to emulate (nanos, nanox)
  * @param {function} func
  * @param {boolean} signed the plugin is already signed
  * @returns {Promise}
  */
function zemu(device, func, testNetwork, signed = false) {
    return async () => {
        let eth_path;
        let plugin;
        let sim_options = sim_options_generic;

        if (device === "nanos") {
            eth_path = NANOS_ETH_PATH;
            plugin = NANOS_PLUGIN;
            sim_options.model = "nanos";
        } else if (device === "nanosp") {
            eth_path = NANOSP_ETH_PATH;
            plugin = NANOSP_PLUGIN;
            sim_options.model = "nanosp";
        } else {
            eth_path = NANOX_ETH_PATH;
            plugin = NANOX_PLUGIN;
            sim_options.model = "nanox";
        }

        const sim = new Zemu(eth_path, plugin);

        try {
            await sim.start(sim_options);
            const transport = await sim.getTransport();
            const eth = new Eth(transport);

            if (!signed) {
                config = generate_plugin_config(testNetwork);
                eth.setLoadConfig({
                    pluginBaseURL: null,
                    extraPlugins: config,
                });
            }
            await func(sim, eth);
        } finally {
            await sim.close();
        }
    };
}

async function enableDisableBlindSigning(sim, enable = true) {
    // Navigate and enter the settings
    await sim.navigateUntilText(".", "", "Settings", true, false);
    await sim.clickBoth();
    // This assume that Blind Signing is the first setting.
    const events = await sim.getEvents();
    if (events.some((event) => event.text.includes((enable) ? "Disabled" : "Enabled"))) {
        // Blind signing is disabled.
        sim.log("Activating Blind Signing");
        await sim.clickBoth();
    }
    // Get out of settings
    await sim.navigateUntilText(".", ".", "Back", true, false);
    await sim.clickBoth("", false);
}

/**
 * Process the transaction through the full test process in interaction with the simulator
 * @param {Eth} eth Device to test (nanos, nanox)
 * @param {function} sim Zemu simulator
 * @param {int} steps Number of steps to push right button
 * @param {string} label directory against which the test snapshots must be checked.
 * @param {string} rawTxHex RawTransaction Hex to process
 */
async function processTransaction(eth, sim, steps, label, rawTxHex, srlTx = "") {
    let serializedTx;
    if (srlTx == "")
        serializedTx = txFromEtherscan(rawTxHex);
    else
        serializedTx = srlTx;

    const resolution = await ledgerService.resolveTransaction(serializedTx, {
        nftExplorerBaseURL: null,
        pluginBaseURL: null,
        extraPlugins: config,
    }, {
        nft: true,
        externalPlugins: true,
        erc20: false,
    })
        .catch((e) => {
            console.warn(
                "an error occurred in resolveTransaction => fallback to blind signing: " +
                String(e)
            );
            return null;
        });

    // Check if blind signing is necessary
    await enableDisableBlindSigning(sim);

    let tx = eth.signTransaction("44'/60'/0'/0/0", serializedTx, resolution);

    await sim.waitUntilScreenIsNot(
        sim.getMainMenuSnapshot(),
        transactionUploadDelay
    );

    await sim.navigateAndCompareSnapshots(".", label, [steps, 0]);
    await tx;
}

/**
 * Function to execute test with the simulator
 * @param {Object} device Device including its name, its label, and the number of steps to process the use case
 * @param {string} contractName Name of the contract
 * @param {string} testLabel Name of the test case
 * @param {string} testDirSuffix Name of the folder suffix for snapshot comparison
 * @param {string} rawTxHex RawTx Hex to test
 * @param {boolean} signed The plugin is already signed and existing in Ledger database
 */
function processTest(device, contractName, testLabel, testDirSuffix, rawTxHex, signed, serializedTx, testNetwork) {
    test(
        "[" + contractName + "] - " + device.label + " - " + testLabel,
        zemu(device.name, async (sim, eth) => {
            await processTransaction(
                eth,
                sim,
                device.steps,
                testNetwork + "_" + device.name + "_" + testDirSuffix,
                rawTxHex,
                serializedTx
            );
        }, testNetwork, signed)
    );
}

function populateTransaction(contractAddr, inputData, chainId, value = "0.0") {
    // Get the generic transaction template
    let unsignedTx = genericTx;
    //adapt to the appropriate network
    unsignedTx.chainId = chainId;
    // Modify `to` to make it interact with the contract
    unsignedTx.to = contractAddr;
    // Modify the attached data
    unsignedTx.data = inputData;
    // Modify the number of ETH sent
    unsignedTx.value = parseEther(value);
    // Create serializedTx and remove the "0x" prefix
    return ethers.utils.serializeTransaction(unsignedTx).slice(2);
}

module.exports = {
    processTest,
    populateTransaction,
    zemu,
    genericTx
};