import ejs from "ejs";
import path from "path";
import { transporter } from "../lib/nodemailer";
import config from "../config";

interface SendEmailOptions {
    to: string;
    subject: string;
    template: string;
    data?: Record<string, unknown>;
}

const sendEmail = async ({
    to,
    subject,
    template,
    data = {},
}: SendEmailOptions) => {
    const templatePath = path.join(
        process.cwd(),
        "src",
        "app",
        "templates",
        `${template}.ejs`
    );

    const html = await ejs.renderFile(templatePath, {
        ...data,
        year: new Date().getFullYear(),
    });

    await transporter.sendMail({
        from: `"PH Healthcare" <${config.smtp_emai_sender}>`,
        to,
        subject,
        html,
    });
};

export default sendEmail;