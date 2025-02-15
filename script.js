// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBZzqOAeB4yclKluaFxjRRN2OZVVAM66LU",
    authDomain: "students-fae3c.firebaseapp.com",
    projectId: "students-fae3c",
    storageBucket: "students-fae3c.firebasestorage.app",
    messagingSenderId: "882805671020",
    appId: "1:882805671020:web:6e65219a0779ad046ec449",
    measurementId: "G-03NELEPK0H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Check authentication
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    initializeContacts(); // Initialize contacts after authentication
});

// Function to logout
function logout() {
    auth.signOut();
}

let parsedContacts = [];

// Function to parse bulk data
function parseBulkData(input) {
    const contacts = [];
    let currentPosition = 0;
    const phoneRegex = /\d{10}/g;
    let match;

    while ((match = phoneRegex.exec(input)) !== null) {
        const phone = match[0];
        const startPos = match.index;

        // Get the text before this number
        let name = input.substring(currentPosition, startPos).trim();

        // If no name before the number, look after it
        if (!name && startPos + 10 < input.length) {
            const nextMatch = phoneRegex.exec(input);
            if (nextMatch) {
                name = input.substring(startPos + 10, nextMatch.index).trim();
                phoneRegex.lastIndex = nextMatch.index; // Reset regex position
            } else {
                name = input.substring(startPos + 10).trim();
            }
        }

        if (name) {
            contacts.push({ name, phone });
        }

        currentPosition = startPos + 10;
    }

    // Check for the last name if there's text after the last number
    if (currentPosition < input.length) {
        const lastName = input.substring(currentPosition).trim();
        if (lastName && contacts.length > 0) {
            contacts[contacts.length - 1].name = lastName;
        }
    }

    return contacts;
}

// Function to handle bulk data
function handleBulkData() {
    const input = document.getElementById('contactInput').value;
    parsedContacts = parseBulkData(input);

    const previewArea = document.getElementById('previewArea');
    const previewTable = document.getElementById('previewTable').getElementsByTagName('tbody')[0];
    previewTable.innerHTML = '';

    parsedContacts.forEach(contact => {
        const row = previewTable.insertRow();
        row.insertCell(0).textContent = contact.name;
        row.insertCell(1).textContent = contact.phone;
    });

    previewArea.style.display = 'block';
}

// Function to confirm and add bulk contacts
async function confirmBulkAdd() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const batch = db.batch();

        parsedContacts.forEach((contact, index) => {
            const docRef = db.collection('contacts').doc();
            batch.set(docRef, {
                userId: user.uid,
                name: contact.name,
                phone: contact.phone,
                notes: '',
                timestamp: new Date().toISOString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                order: index
            });
        });

        await batch.commit();
        document.getElementById('contactInput').value = '';
        document.getElementById('previewArea').style.display = 'none';
        loadContacts();
    } catch (error) {
        console.error("Error adding bulk contacts: ", error);
        alert('Error adding contacts');
    }
}

// Rest of the previous functions remain the same
function parseContact(input) {
    input = input.trim();
    const phoneRegex = /(\d{10})/;
    const phoneMatch = input.match(phoneRegex);

    if (!phoneMatch) return null;

    const phone = phoneMatch[1];
    const name = input.replace(phone, '').trim();

    return { name, phone };
}

// Modified addContact function
async function addContact() {
    const user = auth.currentUser;
    if (!user) return;

    const input = document.getElementById('contactInput').value;
    const contact = parseContact(input);

    if (!contact || !contact.name) {
        alert('Please enter both name and a valid 10-digit phone number');
        return;
    }

    try {
        const snapshot = await db.collection('contacts').orderBy('order', 'desc').limit(1).get();
        const lastOrder = snapshot.empty ? 0 : snapshot.docs[0].data().order + 1;

        await db.collection('contacts').add({
            userId: user.uid,
            name: contact.name,
            phone: contact.phone,
            notes: '',
            timestamp: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: lastOrder
        });

        document.getElementById('contactInput').value = '';
        loadContacts();
    } catch (error) {
        console.error("Error adding contact: ", error);
        alert('Error adding contact');
    }
}

let deletedContacts = [];
let undoTimeout;

// Function to show undo message with countdown animation and improved UI
function showUndoMessage() {
    const undoContainer = document.createElement('div');
    undoContainer.id = 'undoContainer';
    undoContainer.style.position = 'fixed';
    undoContainer.style.bottom = '20px';
    undoContainer.style.left = '50%';
    undoContainer.style.transform = 'translateX(-50%)';
    undoContainer.style.backgroundColor = '#333';
    undoContainer.style.color = '#fff';
    undoContainer.style.padding = '10px 20px';
    undoContainer.style.borderRadius = '5px';
    undoContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    undoContainer.style.zIndex = '1000';
    undoContainer.style.display = 'flex';
    undoContainer.style.alignItems = 'center';
    undoContainer.style.gap = '10px';
    undoContainer.innerHTML = `
        <span>Contacts deleted.</span>
        <button onclick="undoDelete()" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Undo</button>
        <span id="countdown" style="font-weight: bold;">5s</span>
    `;
    document.body.appendChild(undoContainer);

    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    const countdownInterval = setInterval(() => {
        countdown -= 1;
        countdownElement.textContent = `${countdown}s`;
        if (countdown === 0) {
            clearInterval(countdownInterval);
            document.body.removeChild(undoContainer);
            deletedContacts = [];
        }
    }, 1000);

    undoTimeout = setTimeout(() => {
        clearInterval(countdownInterval);
        document.body.removeChild(undoContainer);
        deletedContacts = [];
    }, 5000);
}

// Function to undo delete
async function undoDelete() {
    clearTimeout(undoTimeout);
    const undoContainer = document.getElementById('undoContainer');
    if (undoContainer) {
        document.body.removeChild(undoContainer);
    }

    const batch = db.batch();
    deletedContacts.forEach(contact => {
        const docRef = db.collection('contacts').doc(contact.id);
        batch.set(docRef, contact.data);
    });

    try {
        await batch.commit();
        loadContacts();
        deletedContacts = [];
    } catch (error) {
        console.error("Error undoing delete: ", error);
        alert('Error undoing delete');
    }
}

// Modified deleteContact function
async function deleteContact(id) {
    if (!confirm("Are you sure you want to delete this contact?")) {
        return;
    }

    try {
        const docRef = db.collection('contacts').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            deletedContacts.push({ id: doc.id, data: doc.data() });
            await docRef.delete();
            loadContacts();
            showUndoMessage();
        }
    } catch (error) {
        console.error("Error deleting contact: ", error);
        alert('Error deleting contact');
    }
}

// Optimized deleteSelectedContacts function
async function deleteSelectedContacts() {
    if (!confirm("Are you sure you want to delete the selected contacts?")) {
        return;
    }

    const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
    const batch = db.batch();
    let hasContactsToDelete = false;

    const deletePromises = Array.from(checkboxes).map(async checkbox => {
        const id = checkbox.getAttribute('data-id');
        const docRef = db.collection('contacts').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            deletedContacts.push({ id: doc.id, data: doc.data() });
            batch.delete(docRef);
            hasContactsToDelete = true;
        }
    });

    await Promise.all(deletePromises);

    if (!hasContactsToDelete) {
        alert('No contacts selected for deletion.');
        return;
    }

    try {
        await batch.commit();
        loadContacts();
        showUndoMessage();
    } catch (error) {
        console.error("Error deleting selected contacts: ", error);
        alert('Error deleting selected contacts');
    }
}

let timeouts = {};
function updateNotes(id, notes) {
    if (timeouts[id]) {
        clearTimeout(timeouts[id]);
    }

    timeouts[id] = setTimeout(async () => {
        try {
            await db.collection('contacts').doc(id).update({
                notes: notes,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error updating notes: ", error);
        }
    }, 500);
}

// Define createEditableCard as a global function
function createEditableCard(contact) {
    return `
        <div class="contact-header">
            <div class="contact-info">
                <input type="text" class="editable-input" value="${contact.name}" id="name-${contact.id}">
                <input type="tel" class="editable-input" value="${contact.phone}" id="phone-${contact.id}" 
                    pattern="[0-9]{10}" title="Please enter a valid 10-digit phone number">
                <div class="edit-buttons">
                    <button onclick="saveEdit('${contact.id}')" class="edit-button save-edit-button">Save</button>
                    <button onclick="cancelEdit('${contact.id}')" class="edit-button cancel-edit-button">Cancel</button>
                </div>
            </div>
        </div>
        <div class="notes-section">
            <textarea 
                class="notes-input" 
                placeholder="Add notes here..."
                oninput="updateNotes('${contact.id}', this.value)"
            >${contact.notes || ''}</textarea>
            <div class="timestamp">
                ${contact.timestamp ? 'Last updated: ' + new Date(contact.timestamp).toLocaleString() : ''}
            </div>
        </div>
    `;
}

// Add sort functionality
function sortContacts(method) {
    const contactList = document.getElementById('contactList');
    const contacts = Array.from(contactList.getElementsByClassName('contact-card'));
    
    contacts.sort((a, b) => {
        const nameA = a.querySelector('.name').textContent.toLowerCase();
        const nameB = b.querySelector('.name').textContent.toLowerCase();
        
        switch(method) {
            case 'name':
                return nameA.localeCompare(nameB);
            case 'recent':
                const timeA = new Date(a.querySelector('.timestamp').textContent.split(': ')[1] || 0);
                const timeB = new Date(b.querySelector('.timestamp').textContent.split(': ')[1] || 0);
                return timeB - timeA;
            default:
                return 0;
        }
    });
    
    contactList.innerHTML = '';
    contacts.forEach(contact => contactList.appendChild(contact));
}

// Add favorite functionality
async function toggleFavorite(id) {
    const contact = await db.collection('contacts').doc(id).get();
    const isFavorite = contact.data().favorite || false;
    
    await db.collection('contacts').doc(id).update({
        favorite: !isFavorite,
        timestamp: new Date().toISOString()
    });
    
    loadContacts();
}

// Define createNormalCard as a global function
function createNormalCard(contact) {
    const tags = contact.tags || [];
    const isFavorite = contact.favorite || false;
    const callStatus = contact.callStatus || 'Not Called';
    
    return `
        <div class="contact-header">
            <input type="checkbox" class="contact-checkbox" data-id="${contact.id}">
            <div class="contact-info">
                <div class="name-row">
                    <div class="name">${contact.name}</div>
                    <button onclick="event.stopPropagation(); toggleFavorite('${contact.id}')" class="favorite-button ${isFavorite ? 'active' : ''}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                <div class="phone" title="${contact.phone}">${contact.phone}</div>
                <div class="tags-container">
                    ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
            <div class="action-buttons">
                <a href="tel:+91${contact.phone}" class="call-button">
                    <i class="fas fa-phone"></i>
                </a>
                <a href="https://wa.me/91${contact.phone}" class="whatsapp-button" target="_blank">
                    <i class="fab fa-whatsapp"></i>
                </a>
                <button onclick="deleteContact('${contact.id}')" class="delete-button">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="notes-section">
            <textarea 
                class="notes-input" 
                placeholder="Add notes here..."
                oninput="updateNotes('${contact.id}', this.value)"
            >${contact.notes || ''}</textarea>
            <div class="timestamp">
                ${contact.timestamp ? 'Last updated: ' + new Date(contact.timestamp).toLocaleString() : ''}
            </div>
        </div>
        <div class="call-status">
            <select onchange="updateCallStatus('${contact.id}', this.value)">
                <option value="Not Called" ${callStatus === 'Not Called' ? 'selected' : ''}>Not Called</option>
                <option value="Answered" ${callStatus === 'Answered' ? 'selected' : ''}>Answered</option>
                <option value="Not Answered" ${callStatus === 'Not Answered' ? 'selected' : ''}>Not Answered</option>
                <option value="Busy" ${callStatus === 'Busy' ? 'selected' : ''}>Busy</option>
            </select>
        </div>
    `;
}

// Filter contacts by tag
function filterByTag(tag) {
    const contacts = document.getElementsByClassName('contact-card');
    Array.from(contacts).forEach(card => {
        const tags = card.querySelectorAll('.tag');
        const hasTag = Array.from(tags).some(t => t.textContent === tag);
        card.style.display = tag === 'all' || hasTag ? '' : 'none';
    });
}

// Function to filter contacts by call status
function filterByCallStatus(status) {
    const contacts = document.getElementsByClassName('contact-card');
    Array.from(contacts).forEach(card => {
        const callStatus = card.querySelector('.call-status select').value;
        card.style.display = status === 'all' || callStatus === status ? '' : 'none';
    });
}

// Modified createContactCard function
function createContactCard(contact) {
    const contactCard = document.createElement('div');
    contactCard.className = 'contact-card';
    contactCard.innerHTML = createNormalCard(contact);
    return contactCard;
}

// Modified startEdit function
function startEdit(id) {
    const card = document.querySelector(`#contactList .contact-card:has([onclick*="startEdit('${id}')"])`);
    const contact = {
        id: id,
        name: card.querySelector('.name').textContent,
        phone: card.querySelector('.phone').textContent,
        notes: card.querySelector('.notes-input').value,
        timestamp: card.querySelector('.timestamp').textContent
    };
    card.innerHTML = createEditableCard(contact);
}

// Function to save the edited contact
async function saveEdit(id) {
    const name = document.getElementById(`name-${id}`).value;
    const phone = document.getElementById(`phone-${id}`).value;

    if (!name || !phone.match(/^\d{10}$/)) {
        alert('Please enter both name and a valid 10-digit phone number');
        return;
    }

    try {
        await db.collection('contacts').doc(id).update({
            name: name,
            phone: phone,
            timestamp: new Date().toISOString()
        });
        loadContacts();
    } catch (error) {
        console.error("Error saving contact: ", error);
        alert('Error saving contact');
    }
}

// Function to cancel the edit and revert to the normal view
function cancelEdit(id) {
    const card = document.querySelector(`#contactList .contact-card:has([onclick*="cancelEdit('${id}')"])`);
    const contact = {
        id: id,
        name: card.querySelector(`#name-${id}`).value,
        phone: card.querySelector(`#phone-${id}`).value,
        notes: card.querySelector('.notes-input').value,
        timestamp: card.querySelector('.timestamp').textContent
    };
    card.innerHTML = createNormalCard(contact);
}

// Function to toggle select all checkboxes
function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.contact-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = source.checked);
}

// Function to save contacts to local storage
function saveContactsToLocal(contacts) {
    localStorage.setItem('contacts', JSON.stringify(contacts));
}

// Function to load contacts from local storage
function loadContactsFromLocal() {
    const contacts = localStorage.getItem('contacts');
    return contacts ? JSON.parse(contacts) : [];
}

// Modified loadContacts function to sync with local storage
async function loadContacts() {
    const user = auth.currentUser;
    if (!user) return;

    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';

    try {
        const snapshot = await db.collection('contacts')
            .where('userId', '==', user.uid)
            .orderBy('order')
            .get();
        
        const contacts = [];
        snapshot.forEach(doc => {
            const contact = { id: doc.id, ...doc.data() };
            contacts.push(contact);
            contactList.appendChild(createContactCard(contact));
        });

        saveContactsToLocal(contacts);
    } catch (error) {
        console.error("Error loading contacts: ", error);
        alert('Error loading contacts');
    }
}

// Function to initialize contacts from local storage or Firebase
async function initializeContacts() {
    const localContacts = loadContactsFromLocal();
    if (localContacts.length > 0) {
        const contactList = document.getElementById('contactList');
        contactList.innerHTML = '';
        localContacts.forEach(contact => {
            contactList.appendChild(createContactCard(contact));
        });
    } else {
        await loadContacts();
    }
}

// Modified loadContacts function to filter by user
async function loadContacts() {
    const user = auth.currentUser;
    if (!user) return;

    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';

    try {
        const snapshot = await db.collection('contacts')
            .where('userId', '==', user.uid)
            .orderBy('order')
            .get();
            
        snapshot.forEach(doc => {
            const contact = { id: doc.id, ...doc.data() };
            contactList.appendChild(createContactCard(contact));
        });
    } catch (error) {
        console.error("Error loading contacts: ", error);
        alert('Error loading contacts');
    }
}

// Function to search contacts
function searchContacts() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase().trim();
    const contactList = document.getElementById('contactList');
    if (!contactList) return;

    const contactCards = contactList.getElementsByClassName('contact-card');
    
    Array.from(contactCards).forEach(card => {
        try {
            const nameElement = card.querySelector('.name');
            const phoneElement = card.querySelector('.phone');
            
            if (!nameElement || !phoneElement) return;
            
            const name = nameElement.textContent?.toLowerCase() || '';
            const phone = phoneElement.textContent?.toLowerCase() || '';
            
            const isMatch = name.includes(query) || phone.includes(query);
            card.style.display = isMatch ? '' : 'none';
        } catch (error) {
            console.error('Error processing contact card:', error);
        }
    });
}

// Function to toggle theme
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
}

// Function to load theme from localStorage
function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// Function to update call status
async function updateCallStatus(id, status) {
    try {
        await db.collection('contacts').doc(id).update({
            callStatus: status,
            timestamp: new Date().toISOString()
        });
        loadContacts();
    } catch (error) {
        console.error("Error updating call status: ", error);
    }
}

// Function to enhance mobile experience
function enhanceMobileExperience() {
    const contactCards = document.querySelectorAll('.contact-card');
    contactCards.forEach(card => {
        card.addEventListener('touchstart', () => {
            card.style.transform = 'scale(1.02)';
        });
        card.addEventListener('touchend', () => {
            card.style.transform = 'scale(1)';
        });
    });
}

// Call the function to enhance mobile experience
document.addEventListener('DOMContentLoaded', enhanceMobileExperience);

// Initialize the contact list and load theme
initializeContacts();
loadTheme();
