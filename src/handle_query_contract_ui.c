#include "poap_plugin.h"

// Set UI for "Token" screen.
static void set_token_ui(ethQueryContractUI_t *msg, context_t *context) {
    strlcpy(msg->title, "Token", msg->titleLength);

    amountToString(context->token_id, sizeof(context->token_id), 0, "", msg->msg, msg->msgLength);
}

// Set UI for "Beneficiary" screen.
static void set_beneficiary_ui(ethQueryContractUI_t *msg, context_t *context) {
    strlcpy(msg->title, "Beneficiary", msg->titleLength);

    msg->msg[0] = '0';
    msg->msg[1] = 'x';

    getEthAddressStringFromBinary(context->beneficiary, msg->msg + 2, msg->pluginSharedRW->sha3, 0);
}

// Set UI for "Warning" screen.
static void set_warning_ui(ethQueryContractUI_t *msg,
                           const context_t *context __attribute__((unused))) {
    strlcpy(msg->title, "WARNING", msg->titleLength);
    strlcpy(msg->msg, "Unknown token", msg->msgLength);
}

// Helper function that returns the enum corresponding to the screen that should be displayed.
static screens_t get_screen(const ethQueryContractUI_t *msg, const context_t *context) {
    uint8_t index = msg->screenIndex;
    bool token_not_found = !context->token_id;

    switch (index) {
        case 0:
            if (!token_not_found) {
                return TOKEN_SCREEN;
            } else if (token_not_found) {
                return WARN_SCREEN;
            }
            break;
        case 1:
            if (!token_not_found && context->selectorIndex == MINT_TOKEN) {
                return BENEFICIARY_SCREEN;
            } else if (!token_not_found) {
                return FROM_ADDRESS_SCREEN;
            } else if (token_not_found) {
                return WARN_SCREEN;
            }
            break;
        case 2:
            if (!token_not_found) {
                return BENEFICIARY_SCREEN;
            } else if (token_not_found) {
                return WARN_SCREEN;
            }
        default:
            return ERROR;
            break;
    }
}

void handle_query_contract_ui(void *parameters) {
    ethQueryContractUI_t *msg = (ethQueryContractUI_t *) parameters;
    context_t *context = (context_t *) msg->pluginContext;

    memset(msg->title, 0, msg->titleLength);
    memset(msg->msg, 0, msg->msgLength);
    msg->result = ETH_PLUGIN_RESULT_OK;

    screens_t screen = get_screen(msg, context);

    switch (screen) {
        case TOKEN_SCREEN:
            set_token_ui(msg, context);
            break;
        case BENEFICIARY_SCREEN:
            set_beneficiary_ui(msg, context);
            break;
        case WARN_SCREEN:
            set_warning_ui(msg, context);
            break;
        default:
            PRINTF("Received an invalid screenIndex\n");
            msg->result = ETH_PLUGIN_RESULT_ERROR;
            return;
    }
}
