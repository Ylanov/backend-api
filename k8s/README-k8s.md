# README-k8s.md

Инфраструктура Kubernetes для проекта **pyro**

Этот файл — краткий конспект того, как сейчас устроен кластер и что где лежит, чтобы можно было легко поддерживать и развивать инфраструктуру.

---

## 1. Архитектура

Основные компоненты в `namespace: default`:

- **pyro-frontend** — фронт (React/статический, раздаётся через nginx)
- **pyro-api** — backend API (FastAPI)
- **pyro-db** — кластер PostgreSQL (CloudNativePG + PostGIS)
- **MinIO** — локальное S3-хранилище для бэкапов БД
- **Ingress (pyro-ingress)** — входная точка (nginx ingress controller)
- **NetworkPolicy** — ограничение трафика между pod’ами
- **PDB (PodDisruptionBudget)** — защита от одновременного падения всех подов сервиса

Упрощённая схема:

```text
[ интернет / Nginx Proxy Manager ]
                |
        (HTTPS, домен)
                |
         [ nginx ingress ]
                |
        ┌──────┴────────┐
        |               |
   /api -> pyro-api     |  / -> pyro-frontend
                |
                |
           [ pyro-db ]
                |
           [ MinIO (S3) ]
         (бэкапы postgres)
