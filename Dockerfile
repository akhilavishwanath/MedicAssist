# ---------- Base Image ----------
FROM node:24-bookworm

# ---------- Install Python ----------
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- Copy Project ----------
COPY . .

# ---------- Install Backend Node Packages ----------
WORKDIR /app/backend
RUN npm install

# ---------- Install Python Packages ----------
RUN pip3 install --no-cache-dir -r requirements.txt

# ---------- Expose Backend ----------
EXPOSE 3001

ENV PORT=3001

# ---------- Start Backend ----------
CMD ["npm","start"]