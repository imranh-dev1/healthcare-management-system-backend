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