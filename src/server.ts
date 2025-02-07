import express from 'express';
import sequelize from './config/database';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

sequelize
  .authenticate()
  .then(() => console.log('Database connected...'))
  .catch((err) => console.error('Database connection error:', err));

sequelize.sync({ force: false }).then(() => {
  console.log('Tables created successfully!');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
