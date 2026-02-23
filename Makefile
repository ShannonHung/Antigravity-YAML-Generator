.PHONY: gen
# generate yaml files
gen:
	@./generate.sh

# development used command 
test:
	@python -m unittest discover tests

check: 
	@python yaml_generator.py --check

web:
	make -j 2 backend frontend

backend:
	cd file-editor/backend && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd file-editor/frontend && npm run dev

web-down:
	@echo "Stopping frontend (port 3000)..."
	-lsof -ti:3000 | xargs kill -9
	@echo "Stopping backend (port 8000)..."
	-lsof -ti:8000 | xargs kill -9

# Docker commands
# Usage: make push-front TAG=latest
TAG ?= latest

build-front:
	docker build -t my-frontend ./file-editor/frontend

build-front-x86:
	docker buildx build --platform linux/amd64 -t my-frontend-x86 ./file-editor/frontend

# docker build -t my-backend ./file-editor/backend
build-back:
	docker build -t my-backend ./file-editor/backend

build-back-x86:
	docker buildx build --platform linux/amd64 -t my-backend-x86 ./file-editor/backend

web-dev:
	docker-compose up -d

web-dev-down:
	docker-compose down

# Docker image remove
remove-all-img: 
	docker rmi -f my-frontend my-backend shannonhung/file-editor-frontend:latest shannonhung/file-editor-backend:latest

# Docker push commands
push-front-x86:
	docker tag my-frontend-x86 shannonhung/file-editor-frontend:$(TAG)
	docker push shannonhung/file-editor-frontend:$(TAG)

push-back-x86:
	docker tag my-backend-x86 shannonhung/file-editor-backend:$(TAG)
	docker push shannonhung/file-editor-backend:$(TAG)

# Docker push commands
push-front:
	docker tag my-frontend shannonhung/file-editor-frontend:$(TAG)
	docker push shannonhung/file-editor-frontend:$(TAG)

push-back:
	docker tag my-backend shannonhung/file-editor-backend:$(TAG)
	docker push shannonhung/file-editor-backend:$(TAG)

# Production commands
web-prod:
	docker-compose -f docker-compose-prod.yml up -d

web-prod-down:
	docker-compose -f docker-compose-prod.yml down
