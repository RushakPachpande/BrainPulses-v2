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
        time: true,
        env_production: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  