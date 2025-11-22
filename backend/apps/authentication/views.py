from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    ChangePasswordSerializer
)


class RegisterView(generics.CreateAPIView):
    """
    API endpoint pro registraci nového uživatele.
    
    POST /api/auth/register/
    Body: {
        "username": "novyuzivatel",
        "email": "email@example.com",
        "password": "bezpecneheslo123",
        "password2": "bezpecneheslo123",
        "first_name": "Jméno",  # optional
        "last_name": "Příjmení"  # optional
    }
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            "user": UserSerializer(user).data,
            "message": "Uživatel byl úspěšně zaregistrován."
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    API endpoint pro přihlášení uživatele.
    
    POST /api/auth/login/
    Body: {
        "username": "uzivatel",
        "password": "heslo123"
    }
    """
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                "user": UserSerializer(user).data,
                "message": "Přihlášení bylo úspěšné."
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "error": "Neplatné přihlašovací údaje."
            }, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """
    API endpoint pro odhlášení uživatele.
    
    POST /api/auth/logout/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({
            "message": "Odhlášení bylo úspěšné."
        }, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """
    API endpoint pro získání a aktualizaci profilu přihlášeného uživatele.
    
    GET /api/auth/profile/
    PUT /api/auth/profile/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(generics.UpdateAPIView):
    """
    API endpoint pro změnu hesla.
    
    PUT /api/auth/change-password/
    Body: {
        "old_password": "stareheslo",
        "new_password": "noveheslo123",
        "new_password2": "noveheslo123"
    }
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            "message": "Heslo bylo úspěšně změněno."
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_auth_status(request):
    """
    API endpoint pro kontrolu stavu autentizace.
    
    GET /api/auth/status/
    """
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user": UserSerializer(request.user).data
        })
    else:
        return Response({
            "authenticated": False,
            "user": None
        })
