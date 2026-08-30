import cron from 'node-cron';
import { prisma } from './prisma';
import { DoctorVerificationStatus, Role } from '../../generated/prisma/enums';

export const unverifiedDoctorDelete = async () => {
    cron.schedule('* * * * *', async () => {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const unverifyDoctorDeleted = await prisma.user.deleteMany({
                where: {
                    role: Role.DOCTOR,
                    emailVerified: false,
                    createdAt: { lt: oneHourAgo },
                    doctor: {
                        verificationStatus: DoctorVerificationStatus.PENDING
                    }
                },
            })
            if (unverifyDoctorDeleted.count > 0) {
                console.log(`Cron: Deleted Doctor ${unverifyDoctorDeleted.count}, unverified email doctor application older than 1 hour`)
            }
        } catch (error) {
            console.log("Cron: Failed to delete unverified doctor applications", error);

        }
        console.log("Unverified Doctor Delete cron schedule (every 10 minites) Is Runnig.....");
    });
}

export const rejectedDoctorDelete = async () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

            const rejectedDoctorDeleted = await prisma.user.deleteMany({
                where: {
                    role: Role.DOCTOR,
                    doctor: {
                        verificationStatus: DoctorVerificationStatus.REJECT,
                        updatedAt: {
                            lt: oneMonthAgo,
                        },
                    },
                },
            });

            if (rejectedDoctorDeleted.count > 0) {
                console.log(`Cron: Deleted ${rejectedDoctorDeleted.count} rejected doctor(s) older than 1 month`);
            }
        } catch (error) {
            console.log('Cron: Failed to delete rejected doctors older than 1 month', error);
        }

        console.log('Rejected Doctor Delete cron is running (daily at midnight)...');
    });
};