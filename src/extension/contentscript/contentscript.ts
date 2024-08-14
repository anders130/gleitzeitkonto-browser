import { config, constStrings } from './utils/constants';
import View from './view/view';
import Floating from './view/floating';
import Inserted from './view/inserted';
import Communication from './utils/communication';
import Navigation from './utils/navigation';
import Data from './utils/format';
import State from './model/state';
import { PageVariant } from './enums/pageVariant';
import { AccountData, ErrorData } from './types/accountData';

(async () => {
    'use strict';

    /* ==========================================================================================
    >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Main Events <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */

    View.addCustomCSS('./contentscript/gleitzeitkonto-browser.css');

    // ===== Start sending all requests =====
    const state = new State();

    const calculatedData = fetchAccountData(state);

    const outdated = Communication.checkVersionOutdated(); // preload version

    // ===== Wait for correct page to be opened =====
    await Navigation.continuousMenucheck();

    // ===== Add floating display =====
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        Floating.addFloatingDisplay(
            constStrings.prefixOvertime + constStrings.overtimeLoading,
            true,
        );
    } else if (Navigation.getPageVariant() == PageVariant.External) {
        window.addEventListener('DOMContentLoaded', () => {
            Floating.addFloatingDisplay(
                constStrings.prefixOvertime + constStrings.overtimeLoading,
                true,
            );
        });
    }
    // register button click for reload
    const realodBtn = document.getElementById(constStrings.buttonID);
    if (realodBtn) {
        realodBtn.addEventListener('click', () => {
            realodAccountData(state);
        });
    }

    // ===== Register actions for promises resolving =====
    // update the display as soon as new data is available
    calculatedData.then(async () => {
        state.calculateFinished = true;
        View.updateDisplay(await Data.getLatestDisplayFormat(calculatedData, outdated, state));
    });
    outdated.then(async () => {
        state.versionCheckFinished = true;
        View.updateDisplay(await Data.getLatestDisplayFormat(calculatedData, outdated, state));
    });

    try {
        const headerBar = await Navigation.waitForPageLoad(
            config.pageloadingTimeout,
            config.maxPageloadingLoops,
        );

        updateInsertedDisplayOnChange(headerBar, calculatedData, outdated, state);
    } catch (e) {
        Floating.removeFloatingDisplay(); // TODO show error in popup
        console.error(e);
    }
})();

// ============ Main action taking functions =============
// =======================================================

// update the display continuously for as long as the script is loaded
// it is assumed that the page has already loaded completely
async function updateInsertedDisplayOnChange(
    headerBar: HTMLElement,
    calculatedData: Promise<AccountData | ErrorData>,
    outdated: Promise<boolean>,
    state: State,
) {
    const placeOrRemoveInsertedDisplay = async () => {
        // when correct page is open and the display doesn't already exist
        if (Navigation.checkCorrectMenuIsOpen() && !Inserted.getInsertedDisplay()) {
            const latestDisplayFormat = await Data.getLatestDisplayFormat(
                calculatedData,
                outdated,
                state,
            );
            Inserted.addInsertedDisplay(
                headerBar,
                latestDisplayFormat.text,
                latestDisplayFormat.loading,
                state,
            );
        } else if (!Navigation.checkCorrectMenuIsOpen()) {
            // this will also be removed by Fiori but keep remove just in case this behaviour gets changed
            Inserted.removeInsertedDisplay();
        }
    };

    window.addEventListener('hashchange', async () => {
        await placeOrRemoveInsertedDisplay();
    });

    // check if the HeaderBar is being manipulated -> Fiori does sometimes remove the inserted display
    const observer = new MutationObserver(async () => {
        await placeOrRemoveInsertedDisplay();
    });

    // add the display to make sure the observer can actually observe something and the display isn't already removed
    await placeOrRemoveInsertedDisplay();

    observer.observe(headerBar, {
        // config
        attributes: false,
        childList: true,
        subtree: true,
    });
}

// downloads and calculates afterwards, returns a displayable text in any case
async function fetchAccountData(state: State): Promise<AccountData | ErrorData> {
    try {
        const data = await Communication.fetchWorkingTimes(config.startDate, config.endDate);
        state.downloadFinished = true;

        return await Communication.calculateOvertime(data);
    } catch (e) {
        console.error(e);
        return {
            error: {
                message: constStrings.errorMsgs.unableToContactAPI,
            },
        };
    }
}

// called from the reload btn, recalculates the overtime
export function realodAccountData(state: State) {
    View.startLoading(); // start loading immediately

    // == Start new requests ==
    state.downloadFinished = false;
    state.calculateFinished = false;

    const calculatedData = fetchAccountData(state);

    // == Register actions for promise resolving ==
    calculatedData.then(async () => {
        state.calculateFinished = true;
        View.updateDisplay(
            await Data.getLatestDisplayFormat(calculatedData, Promise.resolve(false), state),
        );
    });
}
