"""Development settings"""
from .settings import *

DEBUG = True

ALLOWED_HOSTS = ['*']

# Development apps
INSTALLED_APPS += [
    'debug_toolbar',
]

MIDDLEWARE = [
    'debug_toolbar.middleware.DebugToolbarMiddleware',
] + MIDDLEWARE

# Debug toolbar config
INTERNAL_IPS = [
    '127.0.0.1',
    'localhost',
]

# CORS pro development (pokud chcete volat API z externího frontendu)
# INSTALLED_APPS += ['corsheaders']
# MIDDLEWARE.insert(0, 'corsheaders.middleware.CorsMiddleware')
# CORS_ALLOW_ALL_ORIGINS = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
}

# Email backend pro development (console)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
