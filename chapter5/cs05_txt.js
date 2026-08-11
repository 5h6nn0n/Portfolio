/* javascript code written for chapter 5 case study */

//preparing 4 promises 
const getIpLocation = async () => {
  try {
    const response = await fetch('https://ipwho.is/');
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "API limit reached");
    return data;
  } catch (error) {
    return { error: "Network blocked (Check ad-blockers or file:// protocol)" };
  }
};

/*
const getGeoLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: "Geolocation is not supported by your browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => resolve({ error: error.message }),
      { timeout: 8000 } // Gives up after 8 seconds if ignored or blocked
    );
  });
};
*/

const getGeoLocation = async (isClickTarget) => {
  if (!navigator.geolocation) return { error: "Geolocation not supported" };
  if (!isClickTarget && navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'prompt') return { error: "Requires button click" };
    } catch (e) {}
  }

  // If we reach here, we either already have permission, or the user specifically clicked the location button
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => resolve({ error: error.message }),
      { timeout: 10000 }
    );
  });
};

const getSafeScreenDetails = async (isClickTarget) => {
  if (!window.getScreenDetails) return null;
  if (!isClickTarget && navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: 'window-management' });
      if (perm.state === 'prompt') return { error: "Requires button click" };
    } catch (e) {}
  }

  try {
    return await window.getScreenDetails();
  } catch (error) {
    return { error: error.message };
  }
};

/*
const getSafeScreenDetails = async () => {
  if (!window.getScreenDetails) return null;
  try {
    return await window.getScreenDetails();
  } catch (error) {
    return { error: error.message };
  }
};
*/

async function getSpecificDeviceSnapshot(clickedTarget = null) {
  const snapshot = [];

  try {
    const [
      batteryRaw, 
      storageRaw, 
      mediaRaw,
      geoRaw,
      orientationRaw,
      ipRaw,
      nameRaw
    ] = await Promise.all([
      navigator.getBattery ? navigator.getBattery().catch(e => ({ error: e.message })) : Promise.resolve(null),
      navigator.storage?.estimate ? navigator.storage.estimate().catch(e => ({ error: e.message })) : Promise.resolve(null),
      navigator.mediaDevices?.enumerateDevices ? navigator.mediaDevices.enumerateDevices().catch(e => ({ error: e.message })) : Promise.resolve(null),
      //getGeoLocation(),
      getGeoLocation(clickedTarget === 'location'),
      Promise.resolve(screen.orientation ? screen.orientation.type : window.orientation || "Unknown"),
      getIpLocation(),
      //getSafeScreenDetails(),
      getSafeScreenDetails(clickedTarget === 'screen')
    ]);

    // BATTERY
    if (batteryRaw) {
      if (batteryRaw.error) {
        snapshot.push({ type: "battery", status: `Error: ${batteryRaw.error}` });
      } else {
        snapshot.push({
          type: "battery",
          level: `${Math.round(batteryRaw.level * 100)}%`,
          isCharging: batteryRaw.charging
        });
      }
    }

    // STORAGE
    if (storageRaw) {
      if (storageRaw.error) {
        snapshot.push({ type: "web storage", status: `Error: ${storageRaw.error}` });
      } else {
        snapshot.push({
          type: "web storage",
          totalAllocatedMB: Math.round(storageRaw.quota / (1024 * 1024)),
          usedMB: Math.round(storageRaw.usage / (1024 * 1024))
        });
      }
    }

    // MEDIA DEVICES
    if (mediaRaw) {
      if (mediaRaw.error) {
        snapshot.push({ type: "media devices", status: `Error: ${mediaRaw.error}` });
      } else {
        const audioInputs = mediaRaw.filter(d => d.kind === 'audioinput').length;
        const videoInputs = mediaRaw.filter(d => d.kind === 'videoinput').length;
        snapshot.push({
          type: "media devices",
          microphones: audioInputs,
          cameras: videoInputs
        });
      }
    }

    // SCREEN ORIENTATION
    if (orientationRaw) {
      snapshot.push({
        type: "orientation",
        current: orientationRaw
      });
    }

    // --- SCREEN NAME ---
  if (nameRaw) {
      if (nameRaw.error) {
        snapshot.push({ 
          type: "screen details", 
          action: `<button id="unlockScreenBtn" style="padding: 4px 8px; cursor: pointer;">Unlock to view display details</button>` 
        });
      } else {
        const s = nameRaw.currentScreen;
        snapshot.push({
          type: "screen details",
          name: s.label ? s.label : "Generic Display",
          resolution: `${s.width} x ${s.height}`,
          displayType: s.isInternal ? "Built-in Screen" : "External Monitor"
        });
      }
    }

    // geo LOCATION
    if (geoRaw) {
      if (geoRaw.error === "Requires button click") {
         snapshot.push({
          type: "geolocation",
          action: `<button id="unlockLocationBtn" style="padding: 4px 8px; cursor: pointer;">Unlock to view geolocation</button>`
        });
      } else if (geoRaw.error) {
        snapshot.push({ type: "location", status: `Denied/Failed: ${geoRaw.error}` });
      } else {
        snapshot.push({
          type: "geolocation",
          latitude: geoRaw.coords.latitude.toFixed(4),
          longitude: geoRaw.coords.longitude.toFixed(4),
          accuracy: `Within ${Math.round(geoRaw.coords.accuracy)} meters`
        });
      }
    }
    
// IP LOCATION
    if (ipRaw) {
      if (ipRaw.error) {
        snapshot.push({ type: "IP Location", status: `Error: ${ipRaw.error}` });
      } else {
        snapshot.push({
          type: "IP Location",
          ip: ipRaw.ip || "Unknown",
          city: ipRaw.city || "Unknown",
          region: ipRaw.region || "Unknown",
          country: ipRaw.country || "Unknown",
          isp: ipRaw.connection?.isp || "Unknown"
        });
      }
    }


// render 2 html 
    let promiseCode = ""; 
    for (const item of snapshot) {
      const details = Object.entries(item)
        .filter(([key]) => key !== 'type')
        .map(([key, val]) => {
          if (key === 'action') return val; // Print the button normally
          return `<strong>${key}:</strong> ${val}`;
        })
        .join('<br>'); 

      promiseCode += `<tr>
                        <td style="text-transform: capitalize; width: 30%;"><strong>${item.type}</strong></td>
                        <td>${details}</td>
                      </tr>`;
    }
    document.getElementById("promz").innerHTML = promiseCode; 
  } catch (error) {
    console.error("Critical error building array snapshot:", error);
  }
}

// event delegation
document.getElementById("promz").addEventListener("click", (event) => {
  if (event.target && event.target.id === "unlockScreenBtn") {
    event.target.innerText = "Check your browser for a popup...";
    getSpecificDeviceSnapshot('screen'); 
  }
   if (event.target && event.target.id === "unlockLocationBtn") {
    event.target.innerText = "Check your browser for a popup...";
    getSpecificDeviceSnapshot('geolocation'); 
  }
});

// on page load
getSpecificDeviceSnapshot();

/* original assignment continues */
// Browser Properties & Screen Dimensions: 

// array for browser
let browsers = Array();
browsers[1] = "App: " + navigator.appName;
browsers[2] = "Platform: " + navigator.platform;
browsers[3] = "User Agent: " + navigator.userAgent;

browsers[4] = "Language: " + navigator.language;
browsers[5] = "Core Processors: " + navigator.hardwareConcurrency;
browsers[6] = "Max Touch Points: " + navigator.maxTouchPoints;
browsers[7] = "Vendor: " + navigator.vendor;
browsers[8] = "Online Status: " + navigator.onLine;

let browzCode = " "; // browser
for (let j = 1; j < browsers.length; j++) 
{
   const y = browsers[j];
   browzCode += `<tr><td> ${y} </td></tr>`;
}
document.getElementById("browz").innerHTML = browzCode; // browser

// array for screen
let screens = Array();
screens[1] = "Screen Height: " + screen.height;
screens[2] = "Screen Width: " + screen.width;
screens[3] = "Pixel Depth: " + screen.pixelDepth;

screens[4] = "Availabe Height: " + screen.availHeight;
screens[5] = "Available Width: " + screen.availWidth;
screens[6] = "External Monitor: " + screen.isExtended;

let screenzCode = ""; // screen
for (let l = 1; l < screens.length; l++) 
{
   const z = screens[l];
   screenzCode += `<tr><td> ${z} </td></tr>`;
}
document.getElementById("screenz").innerHTML = screenzCode; // screen

// Safety Tips: list configuration.
let tips = new Array(10); 
tips[1]="Use a VPN service when browsing.";
tips[2]="Don't click on links sent inside an email.";
tips[3]="Enable 2 Factor Authunication (2FA) to layer your passwords.";
tips[4]="Don't log into your bank account while on public wifi (opt for cullular data).";
tips[5]="Report sketchy websites and never pay for a removal request (report that too).";
tips[6]="Install antivirus software.";
tips[7]="Stay lowkey / unassuming.";
tips[8]="Only purchase from trusted sites which use https in the url.";
tips[9]="Keep your firewall settings up to prevent traffic interception.";
tips[10]="Decline cookies when offered.";

let tipzCode="";
for (let i = 1; i < tips.length; i++) 
{
   const x = tips[i];
   tipzCode += `<li>${i}` + ".  " + `${x}</li>`;
}
document.getElementById("tipz").innerHTML = tipzCode;

