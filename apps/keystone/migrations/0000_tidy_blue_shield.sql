CREATE TABLE "samples" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"data" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
