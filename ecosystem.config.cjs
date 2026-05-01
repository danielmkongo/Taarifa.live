module.exports = {
  apps: [
    {
      name: 'taarifa-backend',
      cwd: './backend',
      script: 'src/server.js',
      interpreter: 'node',
      interpreter_args: '--experimental-vm-modules',
      env: { NODE_ENV: 'development' },
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'taarifa-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      shell: true,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
