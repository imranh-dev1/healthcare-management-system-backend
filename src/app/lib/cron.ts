import cron from 'node-cron';

export const unverifiedDoctorDelete = async () => {
    cron.schedule('* * * * *', () => {
        console.log('running a task every minute');
    });
}