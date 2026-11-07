/**
 * PM2 process file for the BrainPulses API.
 *
 * Start / reload with the production env block so NODE_ENV=production
 * (api/src/config/load-env.ts then prefers api/.env.prod):
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload brainpulses-api --env production
 *
 * cwd matches the VPS clone path. Do not wipe api/uploads on deploy.
 */
module.exports = {
  apps: [
    {
      name: 'brainpulses-api',
      cwd: '/root/apps/BrainPulses_v2.0/api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_restarts: 20,
      min_uptime: '10s',
      kill_timeout: 10_000,
      listen_timeout: 10_000,
      time: true,
      out_file: '/root/apps/BrainPulses_v2.0/api/logs/out.log',
      error_file: '/root/apps/BrainPulses_v2.0/api/logs/error.log',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
