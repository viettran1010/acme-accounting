'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
      },
      role: {
        type: Sequelize.STRING,
      },
      companyId: {
        type: Sequelize.INTEGER,
        references: { model: 'companies', key: 'id' },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('users', ['companyId', 'role']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  },
};
