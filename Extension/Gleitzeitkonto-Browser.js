const GleitzeitkontoBrowser = require('./Gleitzeitkonto-Browser_func'); // load script
const time = new GleitzeitkontoBrowser();

(async () => {
    'use strict';   

    /* ==========================================================================================
    >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Main Events <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */

    if (!document.getElementById(time.constStrings.cssID)) { // if not already added
        const link = document.createElement('link');
        link.id = time.constStrings.cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.media = 'all';
        link.href = browser.runtime.getURL('./Gleitzeitkonto-Browser.css');
        document.head.appendChild(link);
    }


    const promiseCalcKontoData = time.fetchServer(time.givenStrings.calcaulteURL);
    const promiseDownloadKontoData = time.getDownloadKontoData(); // preload display to save time

    // Only load the rest of the script once the page for 'Zeiterfassung' ist opened
    await time.continuousMenucheck();

    // Double check; if a different menu is opened no floating display will be added
    if (time.checkCorrectMenuIsOpen()) {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            time.addFloatingDisplay(time.constStrings.prefixOvertime + time.constStrings.overtimeLoading, true);
        }
        else if (config.siteVersion == 'external') {
            // Load event fires too early so no point using that
            window.addEventListener('DOMContentLoaded', () => {
                time.addFloatingDisplay(time.constStrings.prefixOvertime + time.constStrings.overtimeLoading, true);
            })
        }

        // don't await 'promiseDisplayText' even tho we want to change this as soon as the promiseDisplayText is fullfilled,
        // but if the page loads before the promise resolves then the display should be movedToInserted asap
        // -> let this happen asynchronously
        time.updateDisplay(promiseCalcKontoData, true);
        time.updateDisplay(promiseDownloadKontoData, false);
    };


    let loops = 0; // track how often findHeaderBar ran

    // loop to check once the page has actually loaded
    // -> this is determined by checking if the headerbar of the page and the icons in the headerbar are available
    const waitForPageLoad = setInterval(async () => {
        loops++;
        const headerBar = document.getElementById(time.givenStrings.headerBarID); // top bar, empty part
        const icons = document.getElementById(time.givenStrings.iconsID);


        if (headerBar && icons) {
            clearInterval(waitForPageLoad);

            // Only add display when user is still on Zeiterfassung page
            if (time.checkCorrectMenuIsOpen()) {
                time.moveFloatingToInsertedDisplay(headerBar, document.getElementById(time.constStrings.floatingDisplayID)); // make sure DisplayText loaded
            }
            
            time.updateDisplayOnURLChange(headerBar, await promiseDownloadKontoData, false);
        }
        else if (loops > time.config.maxPageloadingLoops) { // page loaded too long or html got changed
            clearInterval(waitForPageLoad);
            time.removeFloatingDisplay(); // TODO show error in popup
            console.error(time.constStrings.errorMsgs.pageloadingtimeExceeded);
        }
    }, 1000); // will be limited to min. 1000 when tab not focused
})();