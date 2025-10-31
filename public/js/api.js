// API functions for communicating with the backend

const API_BASE = '/api';

class PokerAPI {
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            // Handle 204 No Content
            if (response.status === 204) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Get all sessions
    async getSessions(includeImports = false) {
        const endpoint = includeImports ? '/sessions?includeImports=true' : '/sessions';
        return this.request(endpoint);
    }

    // Create new session
    async createSession(sessionData) {
        return this.request('/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    }

    // Create completed session
    async createCompletedSession(sessionData) {
        return this.request('/sessions/completed', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    }

    // Update session
    async updateSession(id, updates) {
        return this.request(`/sessions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    // Cash out session
    async cashOutSession(id, cashOutData) {
        return this.request(`/sessions/${id}/cashout`, {
            method: 'POST',
            body: JSON.stringify(cashOutData),
        });
    }

    // Delete session
    async deleteSession(id) {
        return this.request(`/sessions/${id}`, {
            method: 'DELETE',
        });
    }

    // Get statistics
    async getStats() {
        return this.request('/sessions/stats');
    }

    // Get dropdown configuration
    async getConfig() {
        return this.request('/sessions/config');
    }

    // Add hand note to session
    async addHandNote(sessionId, handNote) {
        return this.request(`/sessions/${sessionId}/hand-notes`, {
            method: 'POST',
            body: JSON.stringify(handNote),
        });
    }

    // Get hand notes for session
    async getHandNotes(sessionId) {
        return this.request(`/sessions/${sessionId}/hand-notes`);
    }

    // Delete hand note
    async deleteHandNote(noteId) {
        return this.request(`/sessions/hand-notes/${noteId}`, {
            method: 'DELETE',
        });
    }

    // Get year progress data
    async getYearProgress(year, filter = 'all') {
        return this.request(`/sessions/year-progress/${year}?filter=${filter}`);
    }

    // Get available years
    async getAvailableYears() {
        return this.request('/sessions/available-years');
    }

    // Get progress data for time period view
    async getProgressData(period = '1m', filter = 'all') {
        return this.request(`/sessions/progress/weekly?period=${period}&filter=${filter}`);
    }

    // Get totals (all, live, online)
    async getTotals() {
        return this.request('/sessions/totals');
    }
}

// Create global API instance
window.pokerAPI = new PokerAPI();

// Utility functions
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function formatDuration(minutes) {
    if (!minutes) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
        return `${mins}m`;
    } else if (mins === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${mins}m`;
    }
}

function showError(message) {
    // Create toast for error messages
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove from DOM after hiding
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

function showSuccess(message) {
    // Create toast for success messages
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove from DOM after hiding
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

function showLoading(show = true) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
}