# Backend Setup

## Prerequisites

Ensure you have the following installed on your system:

- **[Docker](https://www.docker.com/get-started)** (for database containerization)
- **[Node.js](https://nodejs.org/)** & [Yarn](https://yarnpkg.com/getting-started/install) (for package management)
- **ESLint** and **Prettier ESLint** extensions (for code formatting and linting)

## Running the Server

1. Install **Yarn** globally:
   ```sh
   npm install -g yarn
   ```

2. Start the development server:
   ```sh
   yarn run dev
   ```

## Setting Up PostgreSQL with Docker

To use PostgreSQL locally during development, follow these steps:

### 1. Install Docker
- Download and install [Docker](https://www.docker.com/get-started) on your system.

### 2. Start a PostgreSQL Container
Run the following command to set up a PostgreSQL instance inside Docker:

```sh
docker run --name [your-container-name] \
  -e POSTGRES_PASSWORD=[your-password] \
  -e POSTGRES_DB=[your-database-name] \
  -d -p [your-port]:5432 postgres
```

Example:
```sh
docker run --name mypostgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=clothbuddy_backend \
  -d -p 5432:5432 postgres
```

### 3. Connect to the Database
Use the following command to connect via `psql`:

```sh
psql -h localhost -p [your-port] -U [your-username] -d [your-database-name]
```

Example:
```sh
psql -h localhost -p 5432 -U postgres -d clothbuddy_backend
```

## Environment Variables

Create a `.env` file in the root directory and configure the required environment variables. Here is a sample `.env` file:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mysecretpassword
DB_NAME=clothbuddy_backend
JWT_SECRET=your_jwt_secret_key
```

## Additional Notes
- Ensure Docker is running before executing database commands.
- Use `docker ps` to check if the PostgreSQL container is running.
- Use `docker stop [your-container-name]` to stop the container when not in use.

---
This README provides a structured setup guide for your backend. Let me know if you need further enhancements!

