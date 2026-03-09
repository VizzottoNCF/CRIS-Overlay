// ==================== GLOBAL STATE ====================
const IntencaoAssassina = false; // Activate/deactivate assassin intent feature
const App = {
    // DOM Elements
    elements: {
        currPV: null,
        maxPV: null,
        currPD: null,
        assassinIntentButton: null,
        lifeBarFill: null,
        characterName: null
    },
    
    // Data state
    state: {
        assassinIntentActive: false,
        lastState: {},
        currentCharacter: null,
        assassinIntentItem: null,
        fields: null
    },
    
    // Configuration
    config: {
        API_URL: "https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/SEU-ID"
    }
};

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function() {
    // Initialize DOM elements
    App.elements.currPV = document.getElementById("currPV");
    App.elements.maxPV = document.getElementById("maxPV");
    App.elements.currPD = document.getElementById("currPD");
    App.elements.assassinIntentButton = document.getElementById("assassinIntentButton");
    App.elements.lifeBarFill = document.querySelector('.life-bar-fill');
    App.elements.characterName = document.getElementById("character-name");
    
    
    // Log which elements exist on this page
    console.log("Elements initialized:", {
        characterName: !!App.elements.characterName,
        currPV: !!App.elements.currPV,
        assassinIntentButton: !!App.elements.assassinIntentButton
    });

    // Setup event listeners
    setupEventListeners();
    
    // Start fetching data
    fetchCharacter();
    setInterval(fetchCharacter, 500);
});

// ==================== EVENT SETUP ====================
function setupEventListeners() {
    const button = App.elements.assassinIntentButton;
    
    if (button) {
        button.addEventListener("click", handleAssassinIntentClick);
    } else {
        console.error("Button not found!");
    }
}

// ==================== EVENT HANDLERS ====================
function handleAssassinIntentClick() {
    // Toggle state
    App.state.assassinIntentActive = !App.state.assassinIntentActive;
    
    // Update button UI
    updateAssassinIntentButton();
    
    // Update Firebase data
    if (IntencaoAssassina) { updateAssassinIntentInFirebase(App.state.assassinIntentActive); }
}

// ==================== FIREBASE UPDATE ====================
async function updateAssassinIntentInFirebase(isActive) {
    if (!App.state.fields) {
        console.error("No character data loaded yet");
        return;
    }

    if (IntencaoAssassina === false) {
        console.warn("Assassin Intent feature is disabled. No updates will be sent to Firebase.");
        return;
    }

    try {
        const updatedFields = JSON.parse(JSON.stringify(App.state.fields)); 
        updatedFields.name.stringValue = isActive ? "NOME DE INTENCAO" : "NOME PADRAO";
        updatedFields.currentPv.integerValue = String(parseInt(updatedFields.currentPv.integerValue, 10) + (isActive ? 20 : -20));
        updatedFields.maxPv.integerValue = String(parseInt(updatedFields.maxPv.integerValue, 10) + (isActive ? 20 : -20));
        updatedFields.currentPd.integerValue = String(parseInt(updatedFields.currentPd.integerValue, 10) + (isActive ? 4 : -10));
        updatedFields.maxPd.integerValue = String(parseInt(updatedFields.maxPd.integerValue, 10) + (isActive ? 10 : -10));
        updatedFields.bonusDefense.integerValue = String(parseInt(updatedFields.bonusDefense.integerValue, 10) + (isActive ? 10 : -10));
        

        if (Number(updatedFields.currentPd.integerValue) < 1) updatedFields.currentPd.integerValue = "1";
        if (Number(updatedFields.currentPv.integerValue) < 1) updatedFields.currentPv.integerValue = "1";

        // Find and update the assassin intent item in inventory
        const inventory = updatedFields.inventory?.arrayValue?.values || [];
        const itemIndex = inventory.findIndex(item => 
            item.mapValue.fields.name?.stringValue === "(Intenção Assassina)"
        );
        
        if (itemIndex === -1) {
            console.error("Assassin Intent item not found in inventory");
            return;
        }
        
        // Update the equipped status in the cloned inventory
        inventory[itemIndex].mapValue.fields.equipped.booleanValue = isActive;
        updatedFields.inventory.arrayValue.values = inventory;
        
        // Create update mask with ALL fields that changed
        const updateMasks = [
            "name",
            "currentPv",
            "maxPv",
            "currentPd",
            "maxPd",
            "bonusDefense",
            "inventory"
        ];
        
        // Create PATCH request to update all changed fields
        const patchData = {
            fields: updatedFields
        };

        
        // Send update to Firebase
        const response = await fetch(
            App.config.API_URL + "?updateMask.fieldPaths=" + updateMasks.join("&updateMask.fieldPaths="),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(patchData)
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update Firebase: ${response.status} ${errorText}`);
        }
        
        console.log(`Assassin Intent ${isActive ? 'equipped' : 'unequipped'} successfully`);
        
        // Update local state to match Firebase
        App.state.fields = updatedFields;
        App.state.assassinIntentActive = isActive;
        
        // Force a fetch to refresh all data
        await fetchCharacter();

    } catch (error) {
        console.error('Error updating Firebase:', error);
        // Revert UI if update failed
        App.state.assassinIntentActive = !isActive;
        updateAssassinIntentButton();
    }
}

// ==================== FETCH AND UPDATE FUNCTIONS ====================
function updateStatus(currentPV, maximumPV, currentPD) {
    App.elements.currPV.textContent = currentPV;
    App.elements.maxPV.textContent = maximumPV;
    App.elements.currPD.textContent = currentPD;
}

function updateAssassinIntentButton() {
    if (App.elements.assassinIntentButton) {
        App.elements.assassinIntentButton.textContent = App.state.assassinIntentActive ? "RESISTIR" : "CEDER";
    }
}

function updateTabTitle(newTitle) {
    document.title = newTitle;
}

function updateLifeBar(percentage) {
    const fillBar = App.elements.lifeBarFill;
    if (!fillBar) return;
    
    const newWidth = Math.max(0, Math.min(100, percentage)); 
    fillBar.style.width = newWidth + '%';

    if (newWidth < 25) {
        fillBar.style.backgroundColor = '#830c0c';
    } else if (newWidth < 50) {
        fillBar.style.backgroundColor = '#c00d0d';
    } else {
        fillBar.style.backgroundColor = '#e20b0b';
    }
}

function updateCharacterName(name, assassinIntent) {
    const element = App.elements.characterName;
    
    if (!element) return;
    
    // Update character name and style
    element.textContent = name;
    
    if (assassinIntent === true) {
        element.style.fontFamily = 'onryou';
        element.style.background = '-webkit-linear-gradient(#e80000, #ff0303)';
        element.style.webkitBackgroundClip = 'text';
        element.style.letterSpacing = '0.2em';
        element.style.fontSize = '144px';
    } else {
        element.style.fontFamily = 'echoes';
        element.style.background = '-webkit-linear-gradient(#afe7e8, #8b8b8b)';
        element.style.webkitBackgroundClip = 'text';
        element.style.letterSpacing = '0.12em';
        element.style.fontSize = '144px';
    }
}

async function fetchCharacter() {
    try {
        const res = await fetch(App.config.API_URL);
        if (!res.ok) throw new Error("Failed to fetch Firestore data");

        const data = await res.json();
        const fields = data.fields;
        
        // Store fields globally for later updates
        App.state.fields = fields;

        const name = fields.name?.stringValue ?? "Character";
        const currentPV = Number(fields.currentPv?.integerValue ?? 0);
        const maxPV = Number(fields.maxPv?.integerValue ?? 0);
        const currentPD = Number(fields.currentPd?.integerValue ?? 0);

        const newState = { name, currentPV, maxPV, currentPD };

        // Update button state based on Firebase data
        const inventory = fields.inventory?.arrayValue?.values || [];
        const assassinIntent = inventory.find(item => 
            item.mapValue.fields.name?.stringValue === "(Intenção Assassina)"
        );

        if (assassinIntent && App.elements.assassinIntentButton) {
            const isEquipped = assassinIntent.mapValue.fields.equipped?.booleanValue || false;
            App.state.assassinIntentActive = isEquipped;
                
            updateAssassinIntentButton();
        }
        

        if (JSON.stringify(newState) !== JSON.stringify(App.state.lastState)) {
            updateStatus(currentPV, maxPV, currentPD);
            updateTabTitle(name);
            updateLifeBar((currentPV / maxPV) * 100);
            updateCharacterName(name, App.state.assassinIntentActive);
            App.state.lastState = newState;
        }
    } catch (err) {
        console.error(err);
    }
}