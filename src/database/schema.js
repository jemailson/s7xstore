async function initSchema(db, isPg = false) {
  if (isPg) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('owner', 'admin', 'reseller', 'member', 'download_admin')),
        reseller_type VARCHAR(50) CHECK(reseller_type IN ('classic', 'rubi') OR reseller_type IS NULL),
        custom_prefix VARCHAR(10) DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        credits DECIMAL(10,2) NOT NULL DEFAULT 0,
        parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        device_id VARCHAR(255) DEFAULT NULL,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS keys (
        id SERIAL PRIMARY KEY,
        key_code VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'awaiting_activation'
          CHECK(status IN ('awaiting_activation', 'active', 'paused', 'expired', 'deactivated')),
        duration_days NUMERIC NOT NULL DEFAULT 30,
        device_id VARCHAR(255),
        device_info TEXT,
        activation_ip VARCHAR(100),
        activated_at VARCHAR(50),
        expires_at VARCHAR(50),
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS activations (
        id SERIAL PRIMARY KEY,
        key_id INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
        device_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        activated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        key_id INTEGER REFERENCES keys(id) ON DELETE SET NULL,
        key_code VARCHAR(255),
        ip_address VARCHAR(100),
        details TEXT,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE INDEX IF NOT EXISTS idx_keys_user_id ON keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
      CREATE INDEX IF NOT EXISTS idx_keys_device_id ON keys(device_id);
      CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_activations_key_id ON activations(key_id);
      CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE TABLE IF NOT EXISTS discord_permissions (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        username VARCHAR(255),
        global_name VARCHAR(255),
        avatar VARCHAR(255),
        avatar_url TEXT,
        banner VARCHAR(255),
        banner_url TEXT,
        accent_color INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        emoji VARCHAR(100) DEFAULT 'mobile',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        durations TEXT,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS key_reservoir (
        id SERIAL PRIMARY KEY,
        key_code VARCHAR(255) UNIQUE NOT NULL,
        platform VARCHAR(100) NOT NULL,
        duration_days DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'used')),
        used_by VARCHAR(255),
        used_at VARCHAR(50),
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        credits DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payment_id VARCHAR(255),
        external_reference VARCHAR(255) UNIQUE,
        qr_code TEXT,
        qr_code_base64 TEXT,
        ticket_url TEXT,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        platform_type VARCHAR(100) NOT NULL,
        version VARCHAR(100),
        download_url TEXT NOT NULL,
        public_url TEXT,
        tutorial_url TEXT,
        mt_manager_url TEXT,
        channel_url TEXT,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS public_files (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        filename VARCHAR(500) NOT NULL,
        mimetype VARCHAR(200) NOT NULL,
        filesize INTEGER NOT NULL,
        filedata TEXT NOT NULL,
        created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );
    `);

    try { await db.query("ALTER TABLE key_reservoir DROP CONSTRAINT IF EXISTS key_reservoir_platform_check;"); } catch (e) {}
    try { await db.query("ALTER TABLE key_reservoir DROP CONSTRAINT IF EXISTS key_reservoir_duration_days_check;"); } catch (e) {}
    try { await db.query("ALTER TABLE platforms ADD COLUMN IF NOT EXISTS durations TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE keys ALTER COLUMN duration_days TYPE DECIMAL(10,4);"); } catch (e) {}
    try { await db.query("ALTER TABLE key_reservoir ALTER COLUMN duration_days TYPE DECIMAL(10,4);"); } catch (e) {}
    try { await db.query("ALTER TABLE users ALTER COLUMN credits TYPE DECIMAL(10,2);"); } catch (e) {}
    try { await db.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;"); } catch (e) {}
    try { await db.query("ALTER TABLE users ADD COLUMN custom_prefix VARCHAR(10) DEFAULT NULL;"); } catch (e) {}
    try { await db.query("ALTER TABLE users ADD COLUMN display_name VARCHAR(255) DEFAULT NULL;"); } catch (e) {}
    try { await db.query("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL;"); } catch (e) {}
    try { await db.query("ALTER TABLE users ADD COLUMN discord_id VARCHAR(255) UNIQUE DEFAULT NULL;"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN username VARCHAR(255);"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN global_name VARCHAR(255);"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN avatar VARCHAR(255);"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN avatar_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN banner VARCHAR(255);"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN banner_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE discord_permissions ADD COLUMN accent_color INTEGER;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS platform_type VARCHAR(100);"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS download_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS public_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS tutorial_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS mt_manager_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS channel_url TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS updated_at VARCHAR(50);"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS slug VARCHAR(255);"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS icon VARCHAR(100);"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS direct_link TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS tutorial_link TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS mt_manager_link TEXT;"); } catch (e) {}
    try { await db.query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS channel_link TEXT;"); } catch (e) {}
    try {
      await db.query(`
        UPDATE downloads SET 
          platform_type = COALESCE(platform_type, icon, 'android'),
          icon = COALESCE(icon, platform_type, 'android'),
          download_url = COALESCE(download_url, direct_link, ''),
          direct_link = COALESCE(direct_link, download_url, ''),
          public_url = COALESCE(public_url, slug, ''),
          slug = COALESCE(slug, public_url, ''),
          tutorial_url = COALESCE(tutorial_url, tutorial_link, ''),
          tutorial_link = COALESCE(tutorial_link, tutorial_url, ''),
          mt_manager_url = COALESCE(mt_manager_url, mt_manager_link, ''),
          mt_manager_link = COALESCE(mt_manager_link, mt_manager_url, ''),
          channel_url = COALESCE(channel_url, channel_link, ''),
          channel_link = COALESCE(channel_link, channel_url, '');
      `);
    } catch (e) {}
    try {
      await db.query(`
        UPDATE keys 
        SET activated_at = COALESCE(activated_at, created_at),
            expires_at = COALESCE(expires_at, TO_CHAR(TO_TIMESTAMP(created_at, 'YYYY-MM-DD HH24:MI:SS') + (duration_days || ' days')::INTERVAL, 'YYYY-MM-DD HH24:MI:SS'))
        WHERE expires_at IS NULL;
      `);
    } catch (e) {}
    try { await db.query("ALTER TABLE public_files ADD COLUMN IF NOT EXISTS tutorial_url TEXT;"); } catch (e) {}
    try { await db.query("DELETE FROM key_reservoir WHERE status = 'used';"); } catch (e) {}
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_product_permissions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          platform_slug VARCHAR(100) NOT NULL,
          allowed BOOLEAN NOT NULL DEFAULT true,
          created_at VARCHAR(50) NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
          UNIQUE(user_id, platform_slug)
        )
      `);
      await db.query('CREATE INDEX IF NOT EXISTS idx_upp_user_id ON user_product_permissions(user_id)');
    } catch (e) {}
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS system_migrations (
          id VARCHAR(100) PRIMARY KEY,
          applied_at VARCHAR(50)
        );
      `);
      const mig = await db.query("SELECT id FROM system_migrations WHERE id = 'fix_transactions_timezone_utc3'");
      if (!mig.rows || mig.rows.length === 0) {
        await db.query(`
          UPDATE transactions 
          SET created_at = to_char(created_at::timestamp - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI:SS'),
              updated_at = to_char(updated_at::timestamp - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI:SS')
          WHERE created_at IS NOT NULL;
        `);
        await db.query("INSERT INTO system_migrations (id, applied_at) VALUES ('fix_transactions_timezone_utc3', TO_CHAR(NOW() - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI:SS'))");
        console.log('[Migration] Transações antigas ajustadas em -3h para Horário de Brasília.');
      }
    } catch (e) {
      console.log('[Migration Timezone Fix Error/Ignored]:', e.message);
    }
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'reseller', 'member', 'download_admin')),
        reseller_type TEXT CHECK(reseller_type IN ('classic', 'rubi') OR reseller_type IS NULL),
        custom_prefix TEXT DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        credits REAL NOT NULL DEFAULT 0,
        parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        device_id TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_code TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'awaiting_activation'
          CHECK(status IN ('awaiting_activation', 'active', 'paused', 'expired', 'deactivated')),
        duration_days INTEGER NOT NULL DEFAULT 30,
        device_id TEXT,
        device_info TEXT,
        activation_ip TEXT,
        activated_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS activations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        activated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        action TEXT NOT NULL,
        key_id INTEGER REFERENCES keys(id) ON DELETE SET NULL,
        key_code TEXT,
        ip_address TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_keys_user_id ON keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
      CREATE INDEX IF NOT EXISTS idx_keys_device_id ON keys(device_id);
      CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_activations_key_id ON activations(key_id);
      CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE TABLE IF NOT EXISTS discord_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE NOT NULL,
        name TEXT,
        username TEXT,
        global_name TEXT,
        avatar TEXT,
        avatar_url TEXT,
        banner TEXT,
        banner_url TEXT,
        accent_color INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT DEFAULT 'mobile',
        status TEXT NOT NULL DEFAULT 'active',
        durations TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS key_reservoir (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_code TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        duration_days REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'used')),
        used_by TEXT,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        credits REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_id TEXT,
        external_reference TEXT UNIQUE,
        qr_code TEXT,
        qr_code_base64 TEXT,
        ticket_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        platform_type TEXT NOT NULL,
        version TEXT,
        download_url TEXT NOT NULL,
        public_url TEXT,
        tutorial_url TEXT,
        mt_manager_url TEXT,
        channel_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS public_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        filesize INTEGER NOT NULL,
        filedata TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);

    try { db.prepare("ALTER TABLE users ADD COLUMN device_id TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE users ADD COLUMN custom_prefix TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE users ADD COLUMN discord_id TEXT UNIQUE DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN username TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN global_name TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN avatar TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN avatar_url TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN banner TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN banner_url TEXT DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE discord_permissions ADD COLUMN accent_color INTEGER DEFAULT NULL").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN platform_type TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN download_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN public_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN tutorial_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN mt_manager_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN channel_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN updated_at TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN slug TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN icon TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN direct_link TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN tutorial_link TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN mt_manager_link TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE downloads ADD COLUMN channel_link TEXT").run(); } catch (e) {}
    try {
      db.prepare(`
        UPDATE keys 
        SET activated_at = COALESCE(activated_at, created_at),
            expires_at = COALESCE(expires_at, datetime(created_at, '+' || duration_days || ' days'))
        WHERE expires_at IS NULL
      `).run();
    } catch (e) {}
    try { db.prepare("ALTER TABLE public_files ADD COLUMN tutorial_url TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE platforms ADD COLUMN durations TEXT").run(); } catch (e) {}
    try { db.prepare("DELETE FROM key_reservoir WHERE status = 'used'").run(); } catch (e) {}
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS user_product_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          platform_slug TEXT NOT NULL,
          allowed INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          UNIQUE(user_id, platform_slug)
        )
      `).run();
      try { db.prepare('CREATE INDEX IF NOT EXISTS idx_upp_user_id ON user_product_permissions(user_id)').run(); } catch (e2) {}
    } catch (e) {}
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS system_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT
        )
      `).run();
      const mig = db.prepare("SELECT id FROM system_migrations WHERE id = 'fix_transactions_timezone_utc3'").get();
      if (!mig) {
        db.prepare(`
          UPDATE transactions 
          SET created_at = datetime(created_at, '-3 hours'),
              updated_at = datetime(updated_at, '-3 hours')
          WHERE created_at IS NOT NULL
        `).run();
        db.prepare("INSERT INTO system_migrations (id, applied_at) VALUES ('fix_transactions_timezone_utc3', datetime('now', '-3 hours'))").run();
        console.log('[Migration] Transações SQLite antigas ajustadas em -3h para Horário de Brasília.');
      }
    } catch (e) {
      console.log('[Migration Timezone Fix Error/Ignored]:', e.message);
    }
  }
}

module.exports = { initSchema };
