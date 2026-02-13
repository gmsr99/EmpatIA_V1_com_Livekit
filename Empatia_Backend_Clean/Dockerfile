# 1. Usar uma imagem base de Python leve (Linux)
FROM python:3.11-slim

# 2. Definir a pasta de trabalho dentro do contentor
WORKDIR /app

# 3. Copiar a lista de bibliotecas e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copiar o código do agente
COPY agent.py .
# (Se tiveres outros ficheiros .py ou pastas necessárias, copia-os também aqui)

# 5. Comando para arrancar o cérebro
CMD ["python", "agent.py", "start"]