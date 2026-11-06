CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`place_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`category` text,
	`city` text,
	`website_url` text,
	`has_website` integer DEFAULT false NOT NULL,
	`has_chatbot` integer,
	`chatbot_vendor` text,
	`contacted` integer DEFAULT false NOT NULL,
	`negotiation` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_place_id_unique` ON `leads` (`place_id`);