/**
 * EKAMBANI POS — Subscription Renewal backend
 *
 * Google Sheet tabs required:
 *   Subscriptions: A=Device ID, B=Start Days, C=End Days
 *   Renewals: keep the existing layout and data exactly as currently used.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * The GitHub Pages app opens this Web App with ?deviceId=...
 * The renewal form passes the Device ID and Renewal Code to renewSubscription().
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('EKAMBANI Subscription Renewal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Renews the subscription for the supplied browser Device ID.
 * Existing renewal-code validation and one-use Status handling are retained.
 *
 * Subscriptions columns:
 *   A = Device ID
 *   B = Start Days
 *   C = End Days
 */
function renewSubscription(deviceId, renewalCode) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    deviceId = String(deviceId || '').trim();
    renewalCode = String(renewalCode || '').trim();

    if (!deviceId) {
      return { status: false, message: 'Device ID is missing. Please reopen renewal from EKAMBANI POS.' };
    }
    if (!renewalCode) {
      return { status: false, message: 'Please enter your Renewal Code.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetSubs = ss.getSheetByName('Subscriptions');
    const sheetRenew = ss.getSheetByName('Renewals');

    if (!sheetSubs || !sheetRenew) {
      return { status: false, message: "Sheets not found. Please check names: 'Subscriptions' and 'Renewals'." };
    }

    const subsData = sheetSubs.getDataRange().getValues();
    const renewData = sheetRenew.getDataRange().getValues();
    const renewHeaders = sheetRenew.getRange(1, 1, 1, sheetRenew.getLastColumn()).getValues()[0];

    let statusColIndex = renewHeaders.indexOf('Status');
    if (statusColIndex === -1) {
      const newColIndex = renewHeaders.length + 1;
      sheetRenew.getRange(1, newColIndex).setValue('Status');
      statusColIndex = newColIndex - 1;
    }

    let renewalRow = -1;
    for (let i = 1; i < renewData.length; i++) {
      if (String(renewData[i][0]).trim() === renewalCode) {
        renewalRow = i;
        break;
      }
    }

    if (renewalRow === -1) {
      return { status: false, message: 'Invalid Renewal Code!' };
    }
    if (String(renewData[renewalRow][statusColIndex]).trim() === 'Used') {
      return { status: false, message: 'This Renewal Code has already been used!' };
    }

    const renewalDays = parseInt(renewData[renewalRow][1], 10);
    if (isNaN(renewalDays) || renewalDays <= 0) {
      return { status: false, message: 'Renewal code has an invalid number of days.' };
    }

    let subsRow = -1;
    for (let j = 1; j < subsData.length; j++) {
      if (String(subsData[j][0]).trim() === deviceId) {
        subsRow = j;
        break;
      }
    }

    if (subsRow === -1) {
      return { status: false, message: 'Device ID not found in Subscriptions!' };
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + renewalDays);

    // Updated Subscriptions layout: B = Start Days, C = End Days.
    sheetSubs.getRange(subsRow + 1, 2).setValue(today);
    sheetSubs.getRange(subsRow + 1, 3).setValue(endDate);

    // Keep the existing Renewals Status update; no other Renewals columns are changed.
    sheetRenew.getRange(renewalRow + 1, statusColIndex + 1)
      .setValue('Used')
      .setFontColor('white')
      .setBackground('red');

    return {
      status: true,
      message: 'Subscription renewed successfully!\nStart: ' + today.toDateString() + '\nEnd: ' + endDate.toDateString()
    };
  } finally {
    lock.releaseLock();
  }
}
