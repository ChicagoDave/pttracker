// Main application logic

// Version information
const APP_VERSION = '1.1.0';
const BUILD_DATE = new Date().toISOString().split('T')[0];

class PokerTracker {
    constructor() {
        this.sessions = [];
        this.stats = {};
        this.config = {};
        this.calculatedDuration = undefined;
        this.liveSession = null;
        this.liveSessionTimer = null;
        this.handNotes = [];
        this.yearProgressChart = null;
        this.importedAccounts = [];
        this.currentFilter = 'all';
        this.chartFilter = 'all';
        this.chartPeriod = '1m'; // Default to 1 month
        this.totals = { all: 0, live: 0, online: 0 };
        this.init();
    }

    async init() {
        // Set version info
        document.getElementById('appVersion').textContent = APP_VERSION;
        document.getElementById('buildDate').textContent = BUILD_DATE;
        
        // Check authentication first
        const isAuthenticated = await this.checkAuthentication();
        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }
        
        this.setupEventListeners();
        await this.loadConfig();
        await this.loadData();
        await this.loadImportedAccounts();
        await this.loadTotals();
        await this.initProgressChart();
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            return data.authenticated;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }

    setupEventListeners() {
        // New session buttons
        document.getElementById('newCashBtn').addEventListener('click', () => {
            this.openNewSessionModal('cash');
        });

        document.getElementById('newTournamentBtn').addEventListener('click', () => {
            this.openNewSessionModal('tournament');
        });

        // Add completed session button
        document.getElementById('addCompletedBtn').addEventListener('click', () => {
            this.openCompletedSessionModal();
        });

        // Start session button
        document.getElementById('startSessionBtn').addEventListener('click', () => {
            this.createSession();
        });

        // Cash out button
        document.getElementById('confirmCashOutBtn').addEventListener('click', () => {
            this.cashOutSession();
        });

        // Save completed session button
        document.getElementById('saveCompletedBtn').addEventListener('click', () => {
            this.saveCompletedSession();
        });

        // Save edit session button
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            this.saveEditSession();
        });

        // Refresh button for table tab
        document.getElementById('refreshTableBtn').addEventListener('click', () => {
            this.loadData();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Form validation
        document.getElementById('buyIn').addEventListener('input', this.validateBuyIn);
        document.getElementById('cashOutAmount').addEventListener('input', this.validateCashOut);
        
        // Completed session form validation and calculations
        document.getElementById('completedBuyIn').addEventListener('input', this.updateCompletedSessionCalc);
        document.getElementById('completedCashOut').addEventListener('input', this.updateCompletedSessionCalc);
        document.getElementById('startDateTime').addEventListener('change', this.updateCompletedSessionCalc);
        document.getElementById('endDateTime').addEventListener('change', this.updateCompletedSessionCalc);
        
        // Edit session form validation and calculations
        document.getElementById('editBuyIn').addEventListener('input', this.updateEditSessionCalc.bind(this));
        document.getElementById('editCashOut').addEventListener('input', this.updateEditSessionCalc.bind(this));
        document.getElementById('editStartDateTime').addEventListener('change', this.updateEditSessionCalc.bind(this));
        document.getElementById('editEndDateTime').addEventListener('change', this.updateEditSessionCalc.bind(this));
        
        // Chart period selector
        document.querySelectorAll('input[name="chartPeriod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.chartPeriod = e.target.value;
                this.updateProgressChart();
            });
        });
        
        // Tab change event
        document.querySelectorAll('#mainTabs button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', async () => {
                if (tab.id === 'history-tab') {
                    // Reload data with imports when switching to Profit & Loss tab
                    await this.loadData();
                    this.updateSessionsTable();
                }
            });
        });
        
        // Filter buttons
        document.querySelectorAll('input[name="transactionFilter"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.updateSessionsTable();
            });
        });
        
        // Chart filter buttons
        document.querySelectorAll('input[name="chartFilter"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.chartFilter = e.target.value;
                this.updateProgressChart();
            });
        });
    }

    openNewSessionModal(gameType) {
        document.getElementById('gameType').value = gameType;
        document.querySelector('#newSessionModal .modal-title').textContent = 
            `New ${gameType === 'cash' ? 'Cash Game' : 'Tournament'}`;
        
        // Reset form
        document.getElementById('newSessionForm').reset();
        
        // Set defaults after a brief delay to ensure dropdowns are populated
        setTimeout(() => {
            document.getElementById('location').value = 'Rivers';
            document.getElementById('game').value = 'NLHE';
            document.getElementById('blinds').value = '$1/$3';
        }, 50);
        
        const modal = new bootstrap.Modal(document.getElementById('newSessionModal'));
        modal.show();
    }

    openCompletedSessionModal() {
        // Reset form
        document.getElementById('completedSessionForm').reset();
        
        // Set default start time to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(19, 0, 0, 0); // 7 PM
        document.getElementById('startDateTime').value = this.formatDateTimeLocal(yesterday);
        
        // Set default end time to yesterday + 4 hours
        const endTime = new Date(yesterday);
        endTime.setHours(23, 0, 0, 0); // 11 PM
        document.getElementById('endDateTime').value = this.formatDateTimeLocal(endTime);
        
        // Set default cash out to $0
        document.getElementById('completedCashOut').value = '0';
        
        // Set dropdown defaults
        setTimeout(() => {
            document.getElementById('completedLocation').value = 'Rivers';
            document.getElementById('completedGame').value = 'NLHE';
            document.getElementById('completedBlinds').value = '$1/$3';
            this.updateCompletedSessionCalc();
        }, 50);
        
        // Hide profit display initially
        document.getElementById('profitDisplay').style.display = 'none';
        
        const modal = new bootstrap.Modal(document.getElementById('completedSessionModal'));
        modal.show();
    }
    
    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async loadConfig() {
        try {
            this.config = await window.pokerAPI.getConfig();
            this.populateDropdowns();
        } catch (error) {
            console.error('Failed to load config:', error);
            // Use default values if config fails to load
            this.config = {
                casinos: ['Rivers', 'GVC', 'Wind Creek', 'Home Game', 'Other'],
                games: ['NLHE', 'PLO', 'PLO5', 'Mixed', 'Other'],
                blinds: ['$1/$3', '$2/$5', '$5/$10', '$10/$25', '$25/$50', 'Other']
            };
            this.populateDropdowns();
        }
    }

    populateDropdowns() {
        // Populate location dropdowns
        this.populateSelect('location', this.config.casinos);
        this.populateSelect('completedLocation', this.config.casinos);
        this.populateSelect('editLocation', this.config.casinos);
        
        // Populate game dropdowns
        this.populateSelect('game', this.config.games);
        this.populateSelect('completedGame', this.config.games);
        this.populateSelect('editGame', this.config.games);
        
        // Populate blinds dropdowns
        this.populateSelect('blinds', this.config.blinds);
        this.populateSelect('completedBlinds', this.config.blinds);
        this.populateSelect('editBlinds', this.config.blinds);
    }

    populateSelect(elementId, options) {
        const select = document.getElementById(elementId);
        if (!select) return;
        
        // Keep the first default option
        const firstOption = select.querySelector('option');
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }
        
        // Add all options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
        
        // Set defaults based on element ID
        this.setDefaultValues(elementId);
    }

    setDefaultValues(elementId) {
        const select = document.getElementById(elementId);
        if (!select) return;
        
        // Set defaults
        if (elementId.includes('location') || elementId === 'location') {
            select.value = 'Rivers';
        } else if (elementId.includes('game') || elementId === 'game') {
            select.value = 'NLHE';
        } else if (elementId.includes('blinds') || elementId === 'blinds') {
            select.value = '$1/$3';
        }
    }

    async createSession() {
        const gameType = document.getElementById('gameType').value;
        const buyIn = parseFloat(document.getElementById('buyIn').value);
        const location = document.getElementById('location').value;
        const game = document.getElementById('game').value;
        const blinds = document.getElementById('blinds').value;
        const notes = document.getElementById('notes').value.trim();

        if (!buyIn || buyIn <= 0) {
            showError('Please enter a valid buy-in amount');
            return;
        }

        try {
            showLoading(true);
            
            const sessionData = {
                gameType,
                buyIn,
                location: location || undefined,
                game: game || undefined,
                blinds: blinds || undefined,
                notes: notes || undefined
            };

            await window.pokerAPI.createSession(sessionData);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('newSessionModal'));
            modal.hide();
            
            showSuccess('Session started successfully!');
            await this.loadData();
            
            // Open live session tracker for the new session
            const newSession = this.sessions.find(s => s.isActive && 
                s.gameType === gameType && 
                s.buyIn === buyIn);
            if (newSession) {
                this.openLiveSessionTracker(newSession.id);
            }
        } catch (error) {
            showError('Failed to start session: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    async saveCompletedSession() {
        const gameType = document.getElementById('completedGameType').value;
        const buyIn = parseFloat(document.getElementById('completedBuyIn').value);
        const cashOut = parseFloat(document.getElementById('completedCashOut').value);
        const startDate = document.getElementById('startDateTime').value;
        const endDate = document.getElementById('endDateTime').value;
        const location = document.getElementById('completedLocation').value;
        const game = document.getElementById('completedGame').value;
        const blinds = document.getElementById('completedBlinds').value;
        const notes = document.getElementById('completedNotes').value.trim();

        if (!gameType || !buyIn || cashOut === undefined || cashOut === null || !startDate || !endDate) {
            showError('Please fill in all required fields');
            return;
        }

        if (buyIn <= 0) {
            showError('Buy-in must be greater than 0');
            return;
        }

        if (cashOut < 0) {
            showError('Cash out cannot be negative');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
            showError('End time must be after start time');
            return;
        }

        // Use the pre-calculated duration
        const duration = this.calculatedDuration || Math.round((end.getTime() - start.getTime()) / (1000 * 60));

        try {
            showLoading(true);
            
            const sessionData = {
                gameType,
                buyIn,
                cashOut,
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                location: location || undefined,
                game: game || undefined,
                blinds: blinds || undefined,
                notes: notes || undefined
            };

            await window.pokerAPI.createCompletedSession(sessionData);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('completedSessionModal'));
            modal.hide();
            
            showSuccess('Completed session added successfully!');
            await this.loadData();
        } catch (error) {
            showError('Failed to save completed session: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    updateCompletedSessionCalc() {
        const buyIn = parseFloat(document.getElementById('completedBuyIn').value) || 0;
        const cashOut = parseFloat(document.getElementById('completedCashOut').value);
        const startDate = document.getElementById('startDateTime').value;
        const endDate = document.getElementById('endDateTime').value;
        
        const profitDisplay = document.getElementById('profitDisplay');
        const profitAmount = document.getElementById('profitAmount');
        const sessionDuration = document.getElementById('sessionDuration');
        
        if (buyIn > 0 && !isNaN(cashOut) && cashOut >= 0 && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (end > start) {
                const profit = cashOut - buyIn;
                const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                
                profitAmount.textContent = formatCurrency(profit);
                profitAmount.className = profit >= 0 ? 'text-success' : 'text-danger';
                sessionDuration.textContent = formatDuration(duration);
                
                profitDisplay.style.display = 'block';
                profitDisplay.className = profit >= 0 ? 'alert alert-success' : 'alert alert-warning';
                
                // Update the actual form data with calculated duration
                this.calculatedDuration = duration;
            } else {
                profitDisplay.style.display = 'none';
                this.calculatedDuration = undefined;
            }
        } else {
            profitDisplay.style.display = 'none';
            this.calculatedDuration = undefined;
        }
    }

    openEditSessionModal(sessionId) {
        // Don't allow editing imported transactions
        if (typeof sessionId === 'string' && sessionId.startsWith('import_')) {
            showError('Cannot edit imported transactions');
            return;
        }
        
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        // Set session ID
        document.getElementById('editSessionId').value = sessionId;
        
        // Populate form with session data
        document.getElementById('editGameType').value = session.gameType;
        document.getElementById('editBuyIn').value = session.buyIn;
        document.getElementById('editCashOut').value = session.cashOut || 0;
        document.getElementById('editNotes').value = session.notes || '';
        
        // Set dropdowns
        setTimeout(() => {
            document.getElementById('editLocation').value = session.location || '';
            document.getElementById('editGame').value = session.game || '';
            document.getElementById('editBlinds').value = session.blinds || '';
        }, 50);
        
        // Set dates if available
        if (session.date) {
            document.getElementById('editStartDateTime').value = this.formatDateTimeLocal(new Date(session.date));
        }
        if (session.endDate) {
            document.getElementById('editEndDateTime').value = this.formatDateTimeLocal(new Date(session.endDate));
        } else if (!session.isActive) {
            // For completed sessions without endDate, estimate based on duration
            const startDate = new Date(session.date);
            const endDate = new Date(startDate.getTime() + (session.duration || 240) * 60000);
            document.getElementById('editEndDateTime').value = this.formatDateTimeLocal(endDate);
        }
        
        // Show/hide date fields based on session status
        const dateTimeRow = document.getElementById('editDateTimeRow');
        if (session.isActive) {
            dateTimeRow.style.display = 'none';
        } else {
            dateTimeRow.style.display = 'block';
        }
        
        // Update calculations
        setTimeout(() => {
            this.updateEditSessionCalc();
        }, 100);
        
        const modal = new bootstrap.Modal(document.getElementById('editSessionModal'));
        modal.show();
    }

    async saveEditSession() {
        const sessionId = parseInt(document.getElementById('editSessionId').value);
        const gameType = document.getElementById('editGameType').value;
        const buyIn = parseFloat(document.getElementById('editBuyIn').value);
        const cashOut = parseFloat(document.getElementById('editCashOut').value);
        const location = document.getElementById('editLocation').value;
        const game = document.getElementById('editGame').value;
        const blinds = document.getElementById('editBlinds').value;
        const notes = document.getElementById('editNotes').value.trim();
        const startDate = document.getElementById('editStartDateTime').value;
        const endDate = document.getElementById('editEndDateTime').value;

        if (!gameType || !buyIn) {
            showError('Please fill in all required fields');
            return;
        }

        if (buyIn <= 0) {
            showError('Buy-in must be greater than 0');
            return;
        }

        if (!isNaN(cashOut) && cashOut < 0) {
            showError('Cash out cannot be negative');
            return;
        }

        try {
            showLoading(true);
            
            const updates = {
                gameType,
                buyIn,
                location: location || undefined,
                game: game || undefined,
                blinds: blinds || undefined,
                notes: notes || undefined
            };

            // Add cash out and date info if session is completed
            if (!isNaN(cashOut)) {
                updates.cashOut = cashOut;
                updates.profit = cashOut - buyIn;
                updates.isActive = false;
            }

            if (startDate) {
                updates.date = new Date(startDate).toISOString();
            }

            if (endDate && startDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (end > start) {
                    updates.endDate = end.toISOString();
                    updates.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                }
            }

            await window.pokerAPI.updateSession(sessionId, updates);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editSessionModal'));
            modal.hide();
            
            showSuccess('Session updated successfully!');
            await this.loadData();
        } catch (error) {
            showError('Failed to update session: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    updateEditSessionCalc() {
        const buyIn = parseFloat(document.getElementById('editBuyIn').value) || 0;
        const cashOut = parseFloat(document.getElementById('editCashOut').value);
        const startDate = document.getElementById('editStartDateTime').value;
        const endDate = document.getElementById('editEndDateTime').value;
        
        const profitDisplay = document.getElementById('editProfitDisplay');
        const profitAmount = document.getElementById('editProfitAmount');
        const sessionDuration = document.getElementById('editSessionDuration');
        
        if (buyIn > 0 && !isNaN(cashOut) && cashOut >= 0 && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (end > start) {
                const profit = cashOut - buyIn;
                const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                
                profitAmount.textContent = formatCurrency(profit);
                profitAmount.className = profit >= 0 ? 'text-success' : 'text-danger';
                sessionDuration.textContent = formatDuration(duration);
                
                profitDisplay.style.display = 'block';
                profitDisplay.className = profit >= 0 ? 'alert alert-success' : 'alert alert-warning';
            } else {
                profitDisplay.style.display = 'none';
            }
        } else {
            profitDisplay.style.display = 'none';
        }
    }

    openCashOutModal(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        document.getElementById('cashOutSessionId').value = sessionId;
        document.getElementById('cashOutAmount').value = '';
        
        // Calculate automatic duration
        const startTime = new Date(session.date);
        const now = new Date();
        const autoDuration = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
        document.getElementById('duration').value = autoDuration;
        
        document.getElementById('cashOutNotes').value = session.notes || '';

        const modal = new bootstrap.Modal(document.getElementById('cashOutModal'));
        modal.show();
    }

    async cashOutSession() {
        const sessionId = parseInt(document.getElementById('cashOutSessionId').value);
        const cashOut = parseFloat(document.getElementById('cashOutAmount').value);
        let duration = parseInt(document.getElementById('duration').value) || undefined;
        const notes = document.getElementById('cashOutNotes').value.trim();

        if (cashOut === undefined || cashOut === null || isNaN(cashOut)) {
            showError('Please enter a valid cash out amount');
            return;
        }
        
        if (cashOut < 0) {
            showError('Cash out amount cannot be negative');
            return;
        }

        try {
            showLoading(true);
            
            // Get the session to calculate duration if not provided
            const session = this.sessions.find(s => s.id === sessionId);
            if (!duration && session) {
                const startTime = new Date(session.date);
                const now = new Date();
                duration = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
            }
            
            const cashOutData = {
                cashOut,
                duration,
                notes: notes || undefined
            };

            await window.pokerAPI.cashOutSession(sessionId, cashOutData);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('cashOutModal'));
            modal.hide();
            
            showSuccess('Session cashed out successfully!');
            await this.loadData();
        } catch (error) {
            showError('Failed to cash out session: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    async deleteSession(sessionId) {
        // Don't allow deleting imported transactions
        if (typeof sessionId === 'string' && sessionId.startsWith('import_')) {
            showError('Cannot delete imported transactions');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this session?')) {
            return;
        }

        try {
            showLoading(true);
            await window.pokerAPI.deleteSession(sessionId);
            showSuccess('Session deleted successfully!');
            await this.loadData();
        } catch (error) {
            showError('Failed to delete session: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    async loadData() {
        try {
            showLoading(true);
            
            // Include imported transactions if on history tab
            const includeImports = document.querySelector('#history-tab')?.classList.contains('active');
            
            const [sessions, stats] = await Promise.all([
                window.pokerAPI.getSessions(includeImports),
                window.pokerAPI.getStats()
            ]);

            this.sessions = sessions;
            this.stats = stats;
            
            this.updateUI();
            
            // Update progress chart
            await this.updateProgressChart();
            
            // Reload totals
            await this.loadTotals();
        } catch (error) {
            showError('Failed to load data: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    async loadImportedAccounts() {
        try {
            const response = await fetch('/api/sessions/imported-accounts');
            if (response.ok) {
                this.importedAccounts = await response.json();
                // No longer creating tabs - transactions are shown in Sessions/Online
            }
        } catch (error) {
            console.error('Failed to load imported accounts:', error);
        }
    }

    updateImportedAccountsTabs() {
        const tabsList = document.getElementById('mainTabs');
        
        // Remove existing imported account tabs
        const existingImportTabs = tabsList.querySelectorAll('.imported-account-tab');
        existingImportTabs.forEach(tab => tab.remove());
        
        // Add tabs for imported accounts
        this.importedAccounts.forEach(account => {
            const li = document.createElement('li');
            li.className = 'nav-item imported-account-tab';
            li.setAttribute('role', 'presentation');
            
            const button = document.createElement('button');
            button.className = 'nav-link';
            button.id = `account-${account.id}-tab`;
            button.setAttribute('data-bs-toggle', 'tab');
            button.setAttribute('data-bs-target', `#account-${account.id}-content`);
            button.setAttribute('type', 'button');
            button.setAttribute('role', 'tab');
            button.innerHTML = `
                ${account.name}
                <small class="d-block" style="font-size: 0.75rem; opacity: 0.7;">
                    ${(account.real_money_balance || 0).toFixed(2)}
                </small>
            `;
            
            // Add click handler
            button.addEventListener('click', () => {
                this.loadAccountTransactions(account.id);
            });
            
            li.appendChild(button);
            tabsList.appendChild(li);
        });
        
        // Create content panes for imported accounts
        this.createImportedAccountPanes();
    }

    createImportedAccountPanes() {
        const tabContent = document.getElementById('mainTabContent');
        
        // Remove existing imported account panes
        const existingPanes = tabContent.querySelectorAll('.imported-account-pane');
        existingPanes.forEach(pane => pane.remove());
        
        // Create panes for each imported account
        this.importedAccounts.forEach(account => {
            const div = document.createElement('div');
            div.className = 'tab-pane fade imported-account-pane';
            div.id = `account-${account.id}-content`;
            div.setAttribute('role', 'tabpanel');
            div.innerHTML = `
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="mb-0">${account.name} - ${account.platform}</h5>
                    </div>
                    <div class="card-body">
                        <div class="row text-center mb-4">
                            <div class="col-md-3">
                                <h6 class="text-muted">Total Transactions</h6>
                                <h4>${account.transaction_count}</h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Real Money Balance</h6>
                                <h4 class="${account.real_money_balance >= 0 ? 'text-success' : 'text-danger'}">
                                    ${(account.real_money_balance || 0).toFixed(2)}
                                </h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Account Balance</h6>
                                <h4>${(account.current_balance || 0).toFixed(2)}</h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Date Range</h6>
                                <h4 style="font-size: 1rem;">
                                    ${account.first_transaction ? 
                                        `${new Date(account.first_transaction).toLocaleDateString()} - 
                                         ${new Date(account.last_transaction).toLocaleDateString()}` : 
                                        'No transactions'}
                                </h4>
                            </div>
                        </div>
                        <div id="account-${account.id}-transactions">
                            <div class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            tabContent.appendChild(div);
        });
    }

    async loadAccountTransactions(accountId) {
        try {
            const response = await fetch(`/api/sessions/imported/${accountId}`);
            if (response.ok) {
                const transactions = await response.json();
                this.displayAccountTransactions(accountId, transactions);
            }
        } catch (error) {
            console.error('Failed to load account transactions:', error);
        }
    }

    displayAccountTransactions(accountId, transactions) {
        const container = document.getElementById(`account-${accountId}-transactions`);
        
        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-center">No transactions found.</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Balance</th>
                            <th>Real Money Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr class="${t.is_external ? 'table-info' : ''}">
                                <td>${new Date(t.transaction_date).toLocaleString()}</td>
                                <td>
                                    <span class="badge ${this.getTransactionTypeBadgeClass(t.type)}">
                                        ${t.type}
                                    </span>
                                </td>
                                <td class="${t.amount >= 0 ? 'text-success' : 'text-danger'}">
                                    ${t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                                </td>
                                <td>${t.account_balance.toFixed(2)}</td>
                                <td>
                                    <strong class="${t.real_money_balance >= 0 ? 'text-success' : 'text-danger'}">
                                        ${t.real_money_balance.toFixed(2)}
                                    </strong>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getTransactionTypeBadgeClass(type) {
        if (type === 'Purchase - Credit Card') return 'bg-success';
        if (type === 'Redemption') return 'bg-danger';
        if (type.includes('Tournament')) return 'bg-primary';
        if (type.includes('Bonus')) return 'bg-info';
        return 'bg-secondary';
    }

    updateUI() {
        this.updateStats();
        this.updateActiveSessions();
        
        // Check if history tab is active
        const historyTab = document.querySelector('#history-tab');
        if (historyTab && historyTab.classList.contains('active')) {
            this.updateSessionsTable();
        }
    }

    updateStats() {
        const { totalSessions, winRate, hourlyRate, activeSessions } = this.stats;

        // Update stat cards
        document.getElementById('totalSessions').textContent = totalSessions;
        document.getElementById('winRate').textContent = `${Math.round(winRate)}%`;
        document.getElementById('hourlyRate').textContent = formatCurrency(hourlyRate);
        document.getElementById('activeSessions').textContent = activeSessions;
    }

    async loadTotals() {
        try {
            // Get totals from the API
            const totals = await window.pokerAPI.getTotals();
            this.totals = totals;
            
            // Update the totals display
            document.getElementById('totalProfitAll').textContent = formatCurrency(totals.all);
            document.getElementById('totalProfitAll').className = totals.all >= 0 ? 'mb-0 text-success' : 'mb-0 text-danger';
            
            document.getElementById('totalProfitLive').textContent = formatCurrency(totals.live);
            document.getElementById('totalProfitLive').className = totals.live >= 0 ? 'mb-0 text-success' : 'mb-0 text-danger';
            
            document.getElementById('totalProfitOnline').textContent = formatCurrency(totals.online);
            document.getElementById('totalProfitOnline').className = totals.online >= 0 ? 'mb-0 text-success' : 'mb-0 text-danger';
        } catch (error) {
            console.error('Failed to load totals:', error);
        }
    }

    updateActiveSessions() {
        const activeSessions = this.sessions.filter(s => s.isActive);
        const container = document.getElementById('activeSessions-container');
        const list = document.getElementById('activeSessionsList');

        if (activeSessions.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = activeSessions.map(session => this.createSessionCard(session, true)).join('');
    }

    updateSessionsTable() {
        const tbody = document.getElementById('sessionsTableBody');
        
        // Filter sessions based on current filter
        let displaySessions = this.sessions.filter(s => !s.isActive);
        
        switch (this.currentFilter) {
            case 'live':
                // Only show live poker sessions (not imported)
                displaySessions = displaySessions.filter(s => !s.isImported);
                break;
            case 'online':
                // Only show online transactions (imported)
                displaySessions = displaySessions.filter(s => s.isImported);
                break;
            // 'all' shows everything
        }

        if (displaySessions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5">
                        <h5>No ${this.currentFilter === 'live' ? 'live sessions' : this.currentFilter === 'online' ? 'online transactions' : 'sessions'} found</h5>
                        <p>${this.currentFilter === 'live' ? 'Start a live poker session to begin tracking!' : 
                            this.currentFilter === 'online' ? 'Import your online poker transactions to see them here.' : 
                            'Start your first poker session or import online transactions.'}</p>
                    </td>
                </tr>
            `;
            
            // Update summary to show zeros
            document.getElementById('summaryTotalProfit').textContent = formatCurrency(0);
            document.getElementById('summaryTotalProfit').className = 'text-muted mb-0';
            document.getElementById('summaryTotalSessions').textContent = '0';
            document.getElementById('summaryAvgSession').textContent = formatCurrency(0);
            document.getElementById('summaryAvgSession').className = 'text-muted mb-0';
            document.getElementById('summaryTotalHours').textContent = '0h';
            return;
        }

        // Sort sessions by date (newest first) and calculate running totals
        const sortedSessions = displaySessions.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        // Calculate running totals (from oldest to newest)
        let runningTotal = 0;
        const sessionsWithRunningTotal = sortedSessions.reverse().map(session => {
            runningTotal += session.profit || 0;
            return { ...session, runningTotal };
        }).reverse(); // Reverse back to newest first for display

        // Update summary stats based on filter
        let totalProfit, totalSessions, avgSession, totalHours;
        
        if (this.currentFilter === 'all') {
            // Show combined stats
            totalProfit = sessionsWithRunningTotal.reduce((sum, s) => sum + (s.profit || 0), 0);
            totalSessions = sessionsWithRunningTotal.filter(s => !s.isImported).length;
            avgSession = totalSessions > 0 ? 
                sessionsWithRunningTotal.filter(s => !s.isImported).reduce((sum, s) => sum + (s.profit || 0), 0) / totalSessions : 0;
            totalHours = sessionsWithRunningTotal.filter(s => !s.isImported).reduce((sum, s) => sum + ((s.duration || 0) / 60), 0);
        } else if (this.currentFilter === 'live') {
            // Only live session stats
            const liveSessions = sessionsWithRunningTotal.filter(s => !s.isImported);
            totalProfit = liveSessions.reduce((sum, s) => sum + (s.profit || 0), 0);
            totalSessions = liveSessions.length;
            avgSession = totalSessions > 0 ? totalProfit / totalSessions : 0;
            totalHours = liveSessions.reduce((sum, s) => sum + ((s.duration || 0) / 60), 0);
        } else {
            // Only online stats
            const onlineSessions = sessionsWithRunningTotal.filter(s => s.isImported);
            totalProfit = onlineSessions.reduce((sum, s) => sum + (s.profit || 0), 0);
            totalSessions = onlineSessions.length;
            avgSession = totalSessions > 0 ? totalProfit / totalSessions : 0;
            totalHours = 0; // No duration for online transactions
        }

        // Update labels based on filter
        if (this.currentFilter === 'online') {
            document.getElementById('sessionsCountLabel').textContent = 'Total Transactions';
            document.getElementById('avgSessionLabel').textContent = 'Average Transaction';
            document.getElementById('totalHoursLabel').textContent = 'N/A';
        } else {
            document.getElementById('sessionsCountLabel').textContent = 'Total Sessions';
            document.getElementById('avgSessionLabel').textContent = 'Average Session';
            document.getElementById('totalHoursLabel').textContent = 'Total Hours';
        }

        document.getElementById('summaryTotalProfit').textContent = formatCurrency(totalProfit);
        document.getElementById('summaryTotalProfit').className = totalProfit >= 0 ? 'text-success mb-0' : 'text-danger mb-0';
        document.getElementById('summaryTotalSessions').textContent = totalSessions;
        document.getElementById('summaryAvgSession').textContent = formatCurrency(avgSession);
        document.getElementById('summaryAvgSession').className = avgSession >= 0 ? 'text-success mb-0' : 'text-danger mb-0';
        document.getElementById('summaryTotalHours').textContent = this.currentFilter === 'online' ? '-' : `${Math.round(totalHours)}h`;

        // Create table rows
        tbody.innerHTML = sessionsWithRunningTotal.map(session => this.createSessionTableRow(session)).join('');
    }

    createSessionTableRow(session) {
        const profit = session.profit || 0;
        const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
        const runningTotalClass = session.runningTotal >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';

        // Handle imported transactions differently
        if (session.isImported) {
            return `
                <tr class="table-${session.gameType === 'deposit' ? 'warning' : 'info'}">
                    <td>${formatDate(session.date)}</td>
                    <td>${session.location || '-'}</td>
                    <td>
                        <span class="badge ${session.gameType === 'deposit' ? 'bg-warning text-dark' : 'bg-info'}">
                            ${session.importType}
                        </span>
                    </td>
                    <td>-</td>
                    <td>${formatCurrency(session.cashOut)}</td>
                    <td class="${profitClass}">${formatCurrency(profit)}</td>
                    <td class="${runningTotalClass}">${formatCurrency(session.runningTotal)}</td>
                    <td>-</td>
                    <td>
                        <small class="text-muted">Imported</small>
                    </td>
                </tr>
            `;
        }

        return `
            <tr>
                <td>${formatDate(session.date)}</td>
                <td>${session.location || '-'}</td>
                <td>
                    <span class="badge ${session.gameType === 'cash' ? 'bg-success' : 'bg-primary'}">
                        ${session.gameType === 'cash' ? 'Cash' : 'Tourn'}
                    </span>
                    ${session.game || '-'}
                    ${session.blinds ? ` • ${session.blinds}` : ''}
                </td>
                <td>${formatCurrency(session.buyIn)}</td>
                <td>${formatCurrency(session.cashOut || 0)}</td>
                <td class="${profitClass}">${formatCurrency(profit)}</td>
                <td class="${runningTotalClass}">${formatCurrency(session.runningTotal)}</td>
                <td>${session.duration ? formatDuration(session.duration) : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="app.openEditSessionModal(${session.id})" title="Edit">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSession(${session.id})" title="Delete">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }

    createSessionCard(session, isActive) {
        const profit = session.profit || 0;
        const profitClass = profit >= 0 ? 'positive' : 'negative';
        const cardClass = isActive ? 'session-item card active-session' : 'session-item card';

        return `
            <div class="${cardClass} fade-in">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-8">
                            <div class="d-flex align-items-center mb-1">
                                <span class="game-type-badge ${session.gameType === 'cash' ? 'cash-game' : 'tournament'}">
                                    ${session.gameType === 'cash' ? 'Cash' : 'Tournament'}
                                </span>
                                ${session.location ? `<span class="ms-2 session-details">${session.location}</span>` : ''}
                            </div>
                            <div class="session-date">${formatDate(session.date)}</div>
                            <div class="session-details">
                                Buy-in: ${formatCurrency(session.buyIn)}
                                ${session.game ? ` • ${session.game}` : ''}
                                ${session.blinds ? ` • ${session.blinds}` : ''}
                                ${session.duration ? ` • ${formatDuration(session.duration)}` : ''}
                            </div>
                            ${session.notes ? `<div class="session-details mt-1"><small>${session.notes}</small></div>` : ''}
                        </div>
                        <div class="col-4 text-end">
                            ${isActive ? 
                                `<button class="btn cash-out-btn btn-sm mb-1" onclick="app.openCashOutModal(${session.id})">
                                    Cash Out
                                </button>` :
                                `<div class="session-profit ${profitClass}">${formatCurrency(profit)}</div>`
                            }
                            <div>
                                <button class="btn btn-outline-primary btn-sm me-1" onclick="app.openEditSessionModal(${session.id})" title="Edit session">
                                    Edit
                                </button>
                                <button class="delete-btn" onclick="app.deleteSession(${session.id})" title="Delete session">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    validateBuyIn() {
        const input = document.getElementById('buyIn');
        const value = parseFloat(input.value);
        
        if (value <= 0) {
            input.setCustomValidity('Buy-in must be greater than 0');
        } else {
            input.setCustomValidity('');
        }
    }

    // Live Session Tracker Methods
    openLiveSessionTracker(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session || !session.isActive) return;

        this.liveSession = session;
        this.handNotes = [];
        
        // Populate session info
        document.getElementById('liveSessionType').textContent = 
            session.gameType === 'cash' ? 'Cash Game' : 'Tournament';
        document.getElementById('liveSessionBuyIn').textContent = formatCurrency(session.buyIn);
        document.getElementById('liveSessionLocation').textContent = session.location || '-';
        document.getElementById('liveSessionGame').textContent = session.game || '-';
        document.getElementById('liveSessionBlinds').textContent = session.blinds || '-';
        
        // Load existing hand notes
        this.loadHandNotes();
        
        // Start timer
        this.startLiveSessionTimer();
        
        // Setup event listeners
        this.setupLiveSessionListeners();
        
        const modal = new bootstrap.Modal(document.getElementById('liveSessionModal'));
        modal.show();
    }

    setupLiveSessionListeners() {
        // Character counter for hand note
        const handNoteText = document.getElementById('handNoteText');
        const handNoteCount = document.getElementById('handNoteCount');
        
        handNoteText.addEventListener('input', () => {
            const count = handNoteText.value.length;
            handNoteCount.textContent = `${count}/500 characters`;
            if (count > 500) {
                handNoteCount.classList.add('text-danger');
            } else {
                handNoteCount.classList.remove('text-danger');
            }
        });
        
        // Add hand note button
        document.getElementById('addHandNoteBtn').onclick = () => {
            this.addHandNote();
        };
        
        // Minimize button
        document.getElementById('minimizeLiveSession').onclick = () => {
            this.minimizeLiveSession();
        };
        
        // Cash out from live session
        document.getElementById('cashOutFromLiveBtn').onclick = () => {
            this.cashOutFromLiveSession();
        };
        
        // Export hand notes
        document.getElementById('exportHandNotesBtn').onclick = () => {
            this.exportHandNotes();
        };
    }

    startLiveSessionTimer() {
        if (this.liveSessionTimer) {
            clearInterval(this.liveSessionTimer);
        }
        
        const updateTimer = () => {
            if (this.liveSession) {
                const startTime = new Date(this.liveSession.date);
                const now = new Date();
                const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                
                const hours = Math.floor(duration / 3600);
                const minutes = Math.floor((duration % 3600) / 60);
                const seconds = duration % 60;
                
                const timerText = hours > 0 ? 
                    `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` :
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                document.getElementById('liveSessionTimer').textContent = timerText;
                document.getElementById('liveSessionDuration').textContent = formatDuration(Math.floor(duration / 60));
            }
        };
        
        updateTimer();
        this.liveSessionTimer = setInterval(updateTimer, 1000);
    }

    async loadHandNotes() {
        if (!this.liveSession) return;
        
        try {
            this.handNotes = await window.pokerAPI.getHandNotes(this.liveSession.id);
            this.updateHandNotesList();
        } catch (error) {
            console.error('Failed to load hand notes:', error);
        }
    }

    async addHandNote() {
        if (!this.liveSession) return;
        
        const handCards = document.getElementById('handCards').value.trim();
        const position = document.getElementById('handPosition').value;
        const result = document.getElementById('handResult').value;
        const noteText = document.getElementById('handNoteText').value.trim();
        
        if (!noteText) {
            showError('Please enter a hand note');
            return;
        }
        
        if (noteText.length > 500) {
            showError('Hand note must be 500 characters or less');
            return;
        }
        
        try {
            const handNote = await window.pokerAPI.addHandNote(this.liveSession.id, {
                handCards: handCards || undefined,
                position: position || undefined,
                result: result || undefined,
                noteText
            });
            
            this.handNotes.push(handNote);
            this.updateHandNotesList();
            
            // Clear form
            document.getElementById('handNoteForm').reset();
            document.getElementById('handNoteCount').textContent = '0/500 characters';
            
            showSuccess('Hand note added!');
        } catch (error) {
            showError('Failed to add hand note: ' + error.message);
        }
    }

    updateHandNotesList() {
        const container = document.getElementById('handNotesList');
        document.getElementById('liveHandCount').textContent = this.handNotes.length;
        
        if (this.handNotes.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted p-3">
                    <p>No hand notes yet. Add your first hand above!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.handNotes.map(note => this.createHandNoteItem(note)).join('');
    }

    createHandNoteItem(note) {
        const timestamp = new Date(note.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        return `
            <div class="hand-note-item">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <div class="hand-meta">
                        ${note.handCards ? `<span class="hand-cards">${note.handCards}</span>` : ''}
                        ${note.position ? `<span class="hand-position ms-1">${note.position}</span>` : ''}
                        ${note.result ? `<span class="hand-result ms-1 ${note.result}">${note.result.toUpperCase()}</span>` : ''}
                    </div>
                    <div class="d-flex align-items-center">
                        <small class="text-muted me-2">${timestamp}</small>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteHandNote(${note.id})" title="Delete note">
                            ×
                        </button>
                    </div>
                </div>
                <div class="hand-note-text">${note.noteText}</div>
            </div>
        `;
    }

    async deleteHandNote(noteId) {
        if (!confirm('Delete this hand note?')) return;
        
        try {
            await window.pokerAPI.deleteHandNote(noteId);
            this.handNotes = this.handNotes.filter(note => note.id !== noteId);
            this.updateHandNotesList();
            showSuccess('Hand note deleted');
        } catch (error) {
            showError('Failed to delete hand note: ' + error.message);
        }
    }

    minimizeLiveSession() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('liveSessionModal'));
        modal.hide();
        
        // Create minimized button
        const minimizedBtn = document.createElement('button');
        minimizedBtn.className = 'minimized-live-session';
        minimizedBtn.innerHTML = `
            <span class="navbar-icon">♠</span> Live Session
            <div style="font-size: 0.8rem;" id="minimizedTimer">0:00</div>
        `;
        minimizedBtn.onclick = () => {
            document.body.removeChild(minimizedBtn);
            const modal = new bootstrap.Modal(document.getElementById('liveSessionModal'));
            modal.show();
        };
        
        document.body.appendChild(minimizedBtn);
        
        // Update minimized timer
        const updateMinimizedTimer = () => {
            const timerText = document.getElementById('liveSessionTimer').textContent;
            const minimizedTimer = document.getElementById('minimizedTimer');
            if (minimizedTimer) {
                minimizedTimer.textContent = timerText;
            }
        };
        
        setInterval(updateMinimizedTimer, 1000);
    }

    cashOutFromLiveSession() {
        if (!this.liveSession) return;
        
        // Hide live session modal
        const liveModal = bootstrap.Modal.getInstance(document.getElementById('liveSessionModal'));
        liveModal.hide();
        
        // Open cash out modal
        this.openCashOutModal(this.liveSession.id);
        
        // Clean up live session
        setTimeout(() => {
            this.closeLiveSession();
        }, 500);
    }

    closeLiveSession() {
        if (this.liveSessionTimer) {
            clearInterval(this.liveSessionTimer);
            this.liveSessionTimer = null;
        }
        
        this.liveSession = null;
        this.handNotes = [];
        
        // Remove minimized button if it exists
        const minimizedBtn = document.querySelector('.minimized-live-session');
        if (minimizedBtn) {
            document.body.removeChild(minimizedBtn);
        }
    }

    exportHandNotes() {
        if (this.handNotes.length === 0) {
            showError('No hand notes to export');
            return;
        }
        
        const content = this.handNotes.map(note => {
            const timestamp = new Date(note.timestamp).toLocaleString();
            let line = `[${timestamp}]`;
            if (note.handCards) line += ` ${note.handCards}`;
            if (note.position) line += ` (${note.position})`;
            if (note.result) line += ` [${note.result.toUpperCase()}]`;
            line += `\n${note.noteText}\n`;
            return line;
        }).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poker-session-${this.liveSession.id}-notes.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Hand notes exported!');
    }

    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                // Redirect to login page
                window.location.href = '/login';
            } else {
                showError('Logout failed');
            }
        } catch (error) {
            console.error('Logout error:', error);
            showError('Logout failed');
        }
    }

    validateCashOut() {
        const input = document.getElementById('cashOutAmount');
        const value = parseFloat(input.value);
        
        if (isNaN(value) || value < 0) {
            input.setCustomValidity('Cash out amount cannot be negative');
        } else {
            input.setCustomValidity('');
        }
    }

    async initProgressChart() {
        try {
            await this.updateProgressChart();
        } catch (error) {
            console.error('Failed to initialize progress chart:', error);
        }
    }

    async updateProgressChart() {
        try {
            // Get progress data based on period and filter
            const progressData = await window.pokerAPI.getProgressData(this.chartPeriod, this.chartFilter);
            
            // Prepare data for Chart.js
            const labels = [];
            const periodProfits = [];
            const cumulativeProfits = [];
            
            progressData.forEach(item => {
                // Format date for weekly data
                const date = new Date(item.week);
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                labels.push(label);
                periodProfits.push(item.weeklyProfit);
                cumulativeProfits.push(item.cumulativeProfit);
            });
            
            // If no data, show empty chart with message
            if (progressData.length === 0) {
                labels.push('No data');
                periodProfits.push(0);
                cumulativeProfits.push(0);
            }
            
            const ctx = document.getElementById('yearProgressChart').getContext('2d');
            
            // Destroy existing chart if it exists
            if (this.yearProgressChart) {
                this.yearProgressChart.destroy();
            }
            
            // Create new chart
            this.yearProgressChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Cumulative Profit',
                            data: cumulativeProfits,
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            fill: true,
                            tension: 0.1,
                            pointRadius: progressData.length > 50 ? 0 : 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Weekly Profit',
                            data: periodProfits,
                            type: 'bar',
                            backgroundColor: periodProfits.map(profit => 
                                profit >= 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                            ),
                            borderColor: periodProfits.map(profit => 
                                profit >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                            ),
                            borderWidth: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += formatCurrency(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 20
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Cumulative Profit ($)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Weekly Profit ($)'
                            },
                            grid: {
                                drawOnChartArea: false
                            },
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to update year progress chart:', error);
            showError('Failed to load year progress data');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PokerTracker();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}