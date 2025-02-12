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
    try {
        const batch = db.batch();

        parsedContacts.forEach((contact, index) => {
            const docRef = db.collection('contacts').doc();
            batch.set(docRef, {
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

// Modified addContact function to include createdAt and order timestamp
async function addContact() {
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

async function deleteContact(id) {
    if (!confirm("Are you sure you want to delete this contact?")) {
        return;
    }

    try {
        await db.collection('contacts').doc(id).delete();
        loadContacts();
    } catch (error) {
        console.error("Error deleting contact: ", error);
        alert('Error deleting contact');
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

// Define createNormalCard as a global function
function createNormalCard(contact) {
    return `
        <div class="contact-header">
            <input type="checkbox" class="contact-checkbox" data-id="${contact.id}">
            <div class="contact-info">
                <div class="name">${contact.name}</div>
                <div class="phone">${contact.phone}</div>
                <button onclick="startEdit('${contact.id}')" class="edit-button">Edit</button>
            </div>
            <a href="tel:+91${contact.phone}" class="call-button">Call</a>
            <button onclick="deleteContact('${contact.id}')" class="delete-button">Delete</button>
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

// Function to delete selected contacts
async function deleteSelectedContacts() {
    if (!confirm("Are you sure you want to delete the selected contacts?")) {
        return;
    }

    const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
    const batch = db.batch();

    checkboxes.forEach(checkbox => {
        const id = checkbox.getAttribute('data-id');
        const docRef = db.collection('contacts').doc(id);
        batch.delete(docRef);
    });

    try {
        await batch.commit();
        loadContacts();
    } catch (error) {
        console.error("Error deleting selected contacts: ", error);
        alert('Error deleting selected contacts');
    }
}

// Modified loadContacts function to sort by order field
async function loadContacts() {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';

    try {
        const snapshot = await db.collection('contacts').orderBy('order').get();
        snapshot.forEach(doc => {
            const contact = { id: doc.id, ...doc.data() };
            contactList.appendChild(createContactCard(contact));
        });
    } catch (error) {
        console.error("Error loading contacts: ", error);
        alert('Error loading contacts');
    }
}

// Initialize the contact list
loadContacts();
