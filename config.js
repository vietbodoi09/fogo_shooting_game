// config.js - Configuration for FurboGame on Fogo Mainnet

// ==================== FOGO MAINNET CONFIG ====================
window.FURBO_GAME_CONFIG = {
    // Network Configuration
    NETWORK: 'mainnet',
    RPC_URL: 'https://mainnet.fogo.io',
    
    // Fogo Sessions Configuration
    SESSIONS: {
        SPONSOR: '8HnaXmgFJbvvJxSdjeNyWwMXZb85E35NM4XNg6rxuw3w',
        NETWORK: 'Mainnet', // Use 'Testnet' for testing
        TOKENS: ['So11111111111111111111111111111111111111112'],
        DEFAULT_LIMITS: {
            'So11111111111111111111111111111111111111112': 2_000_000_000n // 2 FOGO
        }
    },
    
    // Game Program ID (Replace with your actual deployed program ID)
    PROGRAM_ID: '9FaxDFbQbYZLmLHoPiLXcnRPiwVHaQ5yM4zLmuKKCXes',
    
    // Game Configuration
    GAME: {
        NAME: 'FurboGame',
        VERSION: '1.0.0',
        
        // Player Settings
        PLAYER_SPEED: 8,
        PLAYER_WIDTH: 70,
        PLAYER_HEIGHT: 80,
        
        // Bullet Settings
        BULLET_SPEED: 15,
        BULLET_WIDTH: 8,
        BULLET_HEIGHT: 20,
        FIRE_RATE: 200, // ms between shots
        
        // Enemy Settings
        ENEMY_SPEED_MIN: 1,
        ENEMY_SPEED_MAX: 3,
        ENEMY_SPAWN_RATE: 1500, // ms between spawns
        ENEMY_WIDTH: 50,
        ENEMY_HEIGHT: 50,
        
        // Scoring
        SCORE_PER_KILL: 100,
        SCORE_PER_SECOND: 10,
        
        // Chain Performance
        MOVE_UPDATE_INTERVAL: 50, // ms between chain updates for movement
        MAX_PENDING_TX: 20
    },
    
    // API Endpoints (if any)
    API: {
        LEADERBOARD: 'https://api.furbo-game.com/leaderboard',
        STATS: 'https://api.furbo-game.com/stats'
    },
    
    // Feature Flags
    FEATURES: {
        REAL_TIME_MOVEMENT: true,
        CHAIN_PERFORMANCE_DASHBOARD: true,
        TRANSACTION_LOGGING: true,
        PARTICLES_EFFECTS: true
    }
};

// ==================== HELPER FUNCTIONS ====================
function getDomain() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost';
    }
    return `https://${window.location.hostname}`;
}

function logConfig() {
    console.log('🎮 FurboGame Configuration Loaded:');
    console.log('   Network:', window.FURBO_GAME_CONFIG.NETWORK);
    console.log('   RPC:', window.FURBO_GAME_CONFIG.RPC_URL);
    console.log('   Program ID:', window.FURBO_GAME_CONFIG.PROGRAM_ID);
    console.log('   Domain:', getDomain());
}

// Initialize when loaded
if (typeof window !== 'undefined') {
    window.FURBO_GAME_CONFIG.DOMAIN = getDomain();
    logConfig();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.FURBO_GAME_CONFIG;
}
