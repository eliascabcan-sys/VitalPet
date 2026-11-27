import os
import importlib

from fastapi import FastAPI
from fastapi.testclient import TestClient


def _load_router(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/vs1/auth/google/callback")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    monkeypatch.setenv("FRONTEND_CALLBACK_PATH", "/oauth-callback")

    import api.vs1.auth_google as auth_google
    return importlib.reload(auth_google)


def test_google_login_uses_303_and_google_location(monkeypatch):
    auth_google = _load_router(monkeypatch)
    app = FastAPI()
    app.include_router(auth_google.router, prefix="/auth")

    client = TestClient(app, follow_redirects=False)
    response = client.get("/auth/google/login")

    assert response.status_code == 303
    assert response.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")


def test_error_redirect_uses_frontend_callback(monkeypatch):
    auth_google = _load_router(monkeypatch)
    response = auth_google._redirigir_con_error("Prueba OAuth")

    assert response.status_code == 303
    assert response.headers["location"].startswith("http://localhost:5173/oauth-callback?")
    assert "error=Prueba+OAuth" in response.headers["location"]
