-- Reference MySQL schema (generated from backend/app/models.py).
-- You don't need to run this: `flask --app run init-db` creates everything.

CREATE DATABASE IF NOT EXISTS ladol_meal_ticketing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ladol_meal_ticketing;

CREATE TABLE companies (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(20) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	color VARCHAR(10), 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE TABLE departments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(120) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE meals (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(120) NOT NULL, 
	description VARCHAR(255), 
	meal_type ENUM('Breakfast','Lunch','Dinner') NOT NULL, 
	package VARCHAR(40), 
	location VARCHAR(80) NOT NULL, 
	menu_date DATE, 
	serve_time TIME, 
	price NUMERIC(10, 2) NOT NULL, 
	status ENUM('Available','Scheduled','Unavailable') NOT NULL, 
	emoji VARCHAR(8), 
	contractor BOOL NOT NULL, 
	for_staff BOOL NOT NULL, 
	image VARCHAR(80), 
	PRIMARY KEY (id)
);

CREATE TABLE roles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(60) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE settings (
	`key` VARCHAR(60) NOT NULL, 
	value VARCHAR(255) NOT NULL, 
	PRIMARY KEY (`key`)
);

CREATE TABLE service_requests (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	requested_by VARCHAR(120) NOT NULL, 
	meal_type VARCHAR(20) NOT NULL, 
	meal_id INTEGER, 
	guests INTEGER NOT NULL, 
	service_date DATE, 
	status ENUM('Pending','Approved','Rejected','Completed') NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(meal_id) REFERENCES meals (id) ON DELETE SET NULL
);

CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	username VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(255), 
	full_name VARCHAR(120) NOT NULL, 
	last_name VARCHAR(80), 
	job_title VARCHAR(120), 
	email VARCHAR(120), 
	phone VARCHAR(40), 
	employee_no VARCHAR(40) NOT NULL, 
	department VARCHAR(120), 
	`role` VARCHAR(60) NOT NULL, 
	company_id INTEGER, 
	failed_logins INTEGER, 
	locked_until DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (username), 
	UNIQUE (employee_no), 
	FOREIGN KEY(company_id) REFERENCES companies (id)
);

CREATE TABLE customers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	customer_no VARCHAR(20) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	company_id INTEGER NOT NULL, 
	eligible BOOL NOT NULL, 
	user_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (customer_no), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE wallet_topups (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	topup_date DATE NOT NULL, 
	staff_no VARCHAR(20) NOT NULL, 
	staff_name VARCHAR(120) NOT NULL, 
	department_id INTEGER NOT NULL, 
	amount NUMERIC(12, 2) NOT NULL, 
	created_by INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(department_id) REFERENCES departments (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE TABLE transactions (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tx_date DATE NOT NULL, 
	tx_time TIME, 
	customer_id INTEGER, 
	user_id INTEGER, 
	served_by INTEGER, 
	customer_name VARCHAR(120) NOT NULL, 
	company_id INTEGER, 
	meal_id INTEGER, 
	meal_type VARCHAR(20) NOT NULL, 
	item VARCHAR(120) NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(10, 2) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id) ON DELETE SET NULL, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(served_by) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(meal_id) REFERENCES meals (id) ON DELETE SET NULL
);

