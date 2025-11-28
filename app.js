/* ============================================
 * TapeTally v2 - Frontend Application
 * GitHub Pages Version with Apps Script Backend
 * ============================================ */

// Global state
const APP = {
  staff: null,
  location: "",
  locations: [],
  activeStudents: [],
  inactiveStudents: [],
  currentStudent: null,
  tapePicks: [],
  settings: {},
  recentLogs: [],
  priorityList: []
};

// DOM Elements
const DOM = {
  initials: null,
  signInBtn: null,
  settingsBtn: null,
  scanBtn: null,
  historyBtn: null,
  locationSelect: null,
  searchActive: null,
  searchInactive: null,
  suggestActive: null,
  suggestInactive: null,
  studentCard: null,
  tapeGrid: null,
  logTapesBtn: null,
  clearAllBtn: null,
  tapeCounter: null,
  statusDisplay: null,
  loadingOverlay: null,
  fatal: null,
  recentActivity: null,
  priorityContainer: null,
  refreshPriority: null
};

// API Helper - calls your Apps Script backend
async function callBackend(functionName, ...args) {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: functionName,
        args: args
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.result;
  } catch (error) {
    console.error('Backend call failed:', error);
    throw error;
  }
}

// Initialize DOM references
function initDOM() {
  DOM.initials = document.getElementById("initials");
  DOM.signInBtn = document.getElementById("signInBtn");
  DOM.settingsBtn = document.getElementById("settingsBtn");
  DOM.scanBtn = document.getElementById("scanBtn");
  DOM.historyBtn = document.getElementById("historyBtn");
  DOM.locationSelect = document.getElementById("loc");
  DOM.searchActive = document.getElementById("searchActive");
  DOM.searchInactive = document.getElementById("searchInactive");
  DOM.suggestActive = document.getElementById("suggest");
  DOM.suggestInactive = document.getElementById("suggestInactive");
  DOM.studentCard = document.getElementById("studentCard");
  DOM.tapeGrid = document.getElementById("tapeGrid");
  DOM.logTapesBtn = document.getElementById("logTapesBtn");
  DOM.clearAllBtn = document.getElementById("clearAllBtn");
  DOM.tapeCounter = document.getElementById("tapeCounter");
  DOM.statusDisplay = document.getElementById("status");
  DOM.loadingOverlay = document.getElementById("loadingOverlay");
  DOM.fatal = document.getElementById("fatal");
  DOM.recentActivity = document.getElementById("recentActivity");
  DOM.priorityContainer = document.getElementById("priorityList");
  DOM.refreshPriority = document.getElementById("refreshPriority");
}

// Show/hide loading overlay
function showLoading(show = true) {
  if (DOM.loadingOverlay) {
    DOM.loadingOverlay.style.display = show ? "flex" : "none";
  }
}

// Show fatal error
function showFatal(msg) {
  if (DOM.fatal) {
    DOM.fatal.style.display = "block";
    DOM.fatal.textContent = "Fatal JS error: " + msg;
  }
  console.error("Fatal error:", msg);
}

// Update status display
function updateStatus(msg, isError = false) {
  if (DOM.statusDisplay) {
    DOM.statusDisplay.textContent = msg;
    DOM.statusDisplay.style.color = isError ? "#ef4444" : "";
  }
}

// Sign In
async function signIn() {
  const initials = DOM.initials.value.trim().toUpperCase();
  if (!initials) {
    updateStatus("Please enter your initials", true);
    return;
  }
  
  showLoading(true);
  
  try {
    const result = await callBackend('staffSignIn', initials);
    APP.staff = result.initials;
    updateStatus("Signed in as " + APP.staff);
    await loadLocations();
  } catch (error) {
    showLoading(false);
    updateStatus("Sign in failed: " + error.message, true);
  }
}

// Load locations
async function loadLocations() {
  try {
    const locations = await callBackend('getLocations');
    APP.locations = locations;
    
    DOM.locationSelect.innerHTML = '<option value="">-- Select Location --</option>';
    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      DOM.locationSelect.appendChild(opt);
    });
    
    showLoading(false);
    updateStatus("Ready");
  } catch (error) {
    showLoading(false);
    updateStatus("Failed to load locations: " + error.message, true);
  }
}

// Location changed
function onLocationChange() {
  APP.location = DOM.locationSelect.value;
  
  if (APP.location) {
    updateStatus("Location: " + APP.location);
    loadPriorityList();
  } else {
    updateStatus("Select a location");
  }
  
  DOM.searchActive.value = "";
  DOM.searchInactive.value = "";
  DOM.suggestActive.innerHTML = "";
  DOM.suggestInactive.innerHTML = "";
  clearStudent();
}

// Search students
async function searchStudents(query, status) {
  if (!query || query.length < 2) {
    const container = status === "ACTIVE" ? DOM.suggestActive : DOM.suggestInactive;
    container.innerHTML = "";
    return;
  }
  
  showLoading(true);
  
  try {
    const results = await callBackend('searchRosterByStatus', query, APP.location, status);
    showLoading(false);
    displaySuggestions(results, status);
  } catch (error) {
    showLoading(false);
    updateStatus("Search failed: " + error.message, true);
  }
}

// Display search suggestions
function displaySuggestions(students, status) {
  const container = status === "ACTIVE" ? DOM.suggestActive : DOM.suggestInactive;
  container.innerHTML = "";
  
  if (!students || students.length === 0) {
    container.innerHTML = '<div class="suggestion-item">No results</div>';
    return;
  }
  
  students.forEach(student => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = student.DisplayName + " (" + student.StudentID + ")";
    div.onclick = () => selectStudent(student);
    container.appendChild(div);
  });
}

// Select student
function selectStudent(student) {
  APP.currentStudent = student;
  
  DOM.suggestActive.innerHTML = "";
  DOM.suggestInactive.innerHTML = "";
  DOM.searchActive.value = "";
  DOM.searchInactive.value = "";
  
  displayStudentCard(student);
  loadStudentTapes(student.StudentID);
}

// Display student card
function displayStudentCard(student) {
  const html = `
    <div class="student-info">
      ${student.PhotoURL ? '<img src="' + student.PhotoURL + '" alt="Photo" class="student-photo">' : ''}
      <div>
        <div class="student-name">${student.DisplayName}</div>
        <div class="student-id">${student.StudentID}</div>
        <div class="student-belt">${student.BeltLevel || 'No belt'}</div>
      </div>
    </div>
  `;
  
  DOM.studentCard.innerHTML = html;
  DOM.studentCard.style.display = "block";
}

// Clear student selection
function clearStudent() {
  APP.currentStudent = null;
  APP.tapePicks = [];
  
  DOM.studentCard.innerHTML = "";
  DOM.studentCard.style.display = "none";
  DOM.tapeGrid.innerHTML = "";
  updateTapeCounter();
}

// Load student's tape history
async function loadStudentTapes(studentId) {
  showLoading(true);
  
  try {
    const logs = await callBackend('getLastLogsFast', studentId);
    showLoading(false);
    displayTapeGrid(logs);
  } catch (error) {
    showLoading(false);
    updateStatus("Failed to load tapes: " + error.message, true);
  }
}

// Display tape grid
function displayTapeGrid(logs) {
  const tapes = [
    "Silver Cycle Tape", "Purple Cycle Tape", "Neon Green Cycle Tape", "Neon Orange Cycle Tape",
    "Red", "Red 2", "White 1", "White 2", "Green 1", "Green 2", "Blue 1", "Blue 2",
    "Black Tape (for Yellow 1st Belt Only)", "Yellow Tape"
  ];
  
  DOM.tapeGrid.innerHTML = "";
  
  tapes.forEach(tape => {
    const lastDate = logs[tape] ? new Date(logs[tape]) : null;
    const earned = !!lastDate;
    
    const button = document.createElement("button");
    button.className = "tape-btn" + (earned ? " earned" : "");
    button.textContent = tape;
    button.onclick = () => toggleTape(tape);
    
    if (earned) {
      const days = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
      button.title = "Last: " + days + " days ago";
    }
    
    DOM.tapeGrid.appendChild(button);
  });
}

// Toggle tape selection
function toggleTape(tape) {
  const idx = APP.tapePicks.findIndex(t => t.tape === tape);
  
  if (idx >= 0) {
    APP.tapePicks.splice(idx, 1);
  } else {
    APP.tapePicks.push({ tape, note: "" });
  }
  
  updateTapeCounter();
  highlightSelectedTapes();
}

// Highlight selected tapes
function highlightSelectedTapes() {
  const buttons = DOM.tapeGrid.querySelectorAll(".tape-btn");
  buttons.forEach(btn => {
    const tape = btn.textContent;
    const selected = APP.tapePicks.some(t => t.tape === tape);
    
    if (selected) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}

// Update tape counter
function updateTapeCounter() {
  if (DOM.tapeCounter) {
    DOM.tapeCounter.textContent = APP.tapePicks.length + " tape picks pending";
  }
}

// Log tapes
async function logTapes() {
  if (!APP.currentStudent) {
    updateStatus("No student selected", true);
    return;
  }
  
  if (APP.tapePicks.length === 0) {
    updateStatus("No tapes selected", true);
    return;
  }
  
  showLoading(true);
  
  let completed = 0;
  let failed = 0;
  
  for (const pick of APP.tapePicks) {
    const payload = {
      studentId: APP.currentStudent.StudentID,
      displayName: APP.currentStudent.DisplayName,
      location: APP.location,
      tape: pick.tape,
      staffInitials: APP.staff,
      note: pick.note
    };
    
    try {
      await callBackend('logTape', payload);
      completed++;
    } catch (error) {
      failed++;
      console.error("Failed to log tape:", error);
    }
  }
  
  showLoading(false);
  
  if (failed > 0) {
    updateStatus("Logged " + completed + " of " + APP.tapePicks.length, true);
  } else {
    updateStatus("Logged " + completed + " tapes");
  }
  
  APP.tapePicks = [];
  updateTapeCounter();
  await loadStudentTapes(APP.currentStudent.StudentID);
  await loadRecentActivity();
  await loadPriorityList();
}

// Clear all tape picks
function clearAllPicks() {
  APP.tapePicks = [];
  updateTapeCounter();
  highlightSelectedTapes();
  updateStatus("Cleared all picks");
}

// Load recent activity
async function loadRecentActivity() {
  try {
    const logs = await callBackend('getRecentLogs', 20);
    displayRecentActivity(logs);
  } catch (error) {
    console.error("Failed to load recent activity:", error);
  }
}

// Display recent activity
function displayRecentActivity(logs) {
  if (!DOM.recentActivity) return;
  
  DOM.recentActivity.innerHTML = "";
  
  if (!logs || logs.length === 0) {
    DOM.recentActivity.innerHTML = '<div class="activity-item">No recent activity</div>';
    return;
  }
  
  logs.forEach(log => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `
      <strong>${log.displayName}</strong> - ${log.tape}<br>
      <small>${log.staff} @ ${log.location} - ${new Date(log.timestamp).toLocaleString()}</small>
    `;
    DOM.recentActivity.appendChild(div);
  });
}

// Load priority list
async function loadPriorityList() {
  if (!APP.location) return;
  
  try {
    const priority = await callBackend('getPriorityOverdue', APP.location);
    displayPriorityList(priority);
  } catch (error) {
    console.error("Failed to load priority list:", error);
  }
}

// Display priority list
function displayPriorityList(students) {
  if (!DOM.priorityContainer) return;
  
  DOM.priorityContainer.innerHTML = "";
  
  if (!students || students.length === 0) {
    DOM.priorityContainer.innerHTML = '<div class="priority-item">No overdue students</div>';
    return;
  }
  
  students.slice(0, 10).forEach(student => {
    const div = document.createElement("div");
    div.className = "priority-item";
    
    const overdue = student.overdue[0];
    div.innerHTML = `
      <strong>${student.DisplayName}</strong><br>
      <small>${overdue.tape} - ${overdue.daysOver} days overdue</small>
    `;
    
    div.onclick = async () => {
      try {
        const studentData = await callBackend('fetchRosterById', student.StudentID);
        selectStudent(studentData);
      } catch (error) {
        updateStatus("Failed to load student: " + error.message, true);
      }
    };
    
    DOM.priorityContainer.appendChild(div);
  });
}

// Initialize app
function initApp() {
  try {
    initDOM();
    
    // Event listeners
    DOM.signInBtn.onclick = signIn;
    DOM.initials.onkeypress = (e) => { if (e.key === "Enter") signIn(); };
    DOM.locationSelect.onchange = onLocationChange;
    DOM.searchActive.oninput = (e) => searchStudents(e.target.value, "ACTIVE");
    DOM.searchInactive.oninput = (e) => searchStudents(e.target.value, "INACTIVE");
    DOM.logTapesBtn.onclick = logTapes;
    DOM.clearAllBtn.onclick = clearAllPicks;
    DOM.refreshPriority.onclick = loadPriorityList;
    
    updateStatus("Ready to sign in");
    
  } catch(e) {
    showFatal(e.message);
  }
}

// Run on page load
window.onload = initApp;
