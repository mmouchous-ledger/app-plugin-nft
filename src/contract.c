#include "ledger_nft_plugin.h"

// Function: mint
// Selector: 0x1249c58b
static const uint8_t MINT_SELECTOR[SELECTOR_SIZE] = {0x12, 0x49, 0xc5, 0x8b};
// Function: preSaleMint
// Selector: 0xc111fb91
static const uint8_t PRE_SALE_MINT_SELECTOR[SELECTOR_SIZE] = {0xc1, 0x11, 0xfb, 0x91};

// Plugin uses 0x00000 as a dummy address to reprecent ETH.
const uint8_t NULL_ETH_ADDRESS[ADDRESS_LENGTH] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                                  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                                  0x00, 0x00, 0x00, 0x00, 0x00, 0x00};

// Array of all the different nft selectors.
const uint8_t *const LEDGER_NFT_SELECTORS[NUM_SELECTORS] = {
    MINT_SELECTOR,
    PRE_SALE_MINT_SELECTOR,
};
