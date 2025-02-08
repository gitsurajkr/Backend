## Backend Setup

## Prerequisites

Ensure you have the following installed on your system:

- **[Docker](https://www.docker.com/get-started)** (for database containerization)
- **[Node.js](https://nodejs.org/)** & [Yarn](https://yarnpkg.com/getting-started/install) (for package management)
- **ESLint** and **Prettier ESLint** extensions (for code formatting and linting)
- **Prisma Extension** (for Prisma schema management and database access)

## Running the Server

1. Install **Yarn** globally:

   ```sh
   npm install -g yarn
   ```

2. Install all dependencies:

   ```sh
   yarn install
   ```

3. Start the development server:

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

## Prisma Setup

This project uses **Prisma** as the ORM. Follow these steps to set up Prisma:

### 1. Define Your Prisma Schema

Create or edit the `prisma/schema.prisma` file to define your database models.

### 2. Install Prisma Client

Run the following command to install the Prisma client:

```sh
yarn add @prisma/client
```

### 3. Apply Database Migrations

After modifying the schema, run the following command to apply migrations:

```sh
yarn prisma migrate dev --name [describe-changes]
```

Example:

```sh
yarn prisma migrate dev --name add_user_table
```

### 4. Generate Prisma Client

Ensure that you generate the Prisma client whenever there are schema changes:

```sh
yarn prisma generate
```

## Environment Variables

Create a `.env` file in the root directory and configure the required environment variables. Here is a sample `.env` file:

```env
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/clothbuddy_backend"
```

## Additional Notes

- Ensure Docker is running before executing database commands.
- Use `docker ps` to check if the PostgreSQL container is running.
- Use `docker stop [your-container-name]` to stop the container when not in use.
- Use `docker start [your-container-name]` to start the container when needed.
- Use `yarn prisma studio` to explore the database visually.


