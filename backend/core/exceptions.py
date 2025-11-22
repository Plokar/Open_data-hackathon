"""Core exceptions pro aplikaci"""


class ServiceException(Exception):
    """Základní výjimka pro servisní vrstvu"""
    pass


class NotFoundException(ServiceException):
    """Výjimka pro nenalezené entity"""
    pass


class ValidationException(ServiceException):
    """Výjimka pro validační chyby"""
    pass
