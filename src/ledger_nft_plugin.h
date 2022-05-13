#pragma once

#include <string.h>
#include "eth_internals.h"
#include "eth_plugin_interface.h"

#define NUM_SELECTORS    2
#define PLUGIN_NAME      "Ledger NFT"
#define TOKEN_FOUND      1 << 1
#define SELECTOR_SIZE    4
#define PARAMETER_LENGTH 32
#define RUN_APPLICATION  1

typedef enum {
    MINT,
    PRE_SALE_MINT,
} selector_t;

// Enumeration used to parse the smart contract data.
typedef enum {
    AMOUNT,
    NONE,
} parameter;

typedef enum {
    AMOUNT_SCREEN,
    ERROR,
} screens_t;

extern const uint8_t *const LEDGER_NFT_SELECTORS[NUM_SELECTORS];

// Shared global memory with Ethereum app. Must be at most 5 * 32 bytes.
typedef struct context_t {
    // For display.
    uint8_t amount[PARAMETER_LENGTH];
    char ticker[MAX_TICKER_LEN];

    // For parsing data.
    uint16_t offset;
    uint16_t checkpoint;
    uint8_t skip;
    uint8_t decimals;
    uint8_t next_param;
    uint8_t tokens_found;

    // For both parsing and display.
    selector_t selectorIndex;
} context_t;

// Piece of code that will check that the above structure is not bigger than 5 * 32. Do not remove
// this check.
_Static_assert(sizeof(context_t) <= 5 * 32, "Structure of parameters too big.");

void handle_provide_parameter(void *parameters);
void handle_query_contract_ui(void *parameters);
void handle_init_contract(void *parameters);
void handle_finalize(void *parameters);
void handle_query_contract_id(void *parameters);
