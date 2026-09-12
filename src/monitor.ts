import 'dotenv/config';
import { prisma } from './lib/prisma';

async function monitorDatabase() {
  console.log('🔄 Connecting to Database Monitor for Ecotec System...');

  // VPS/Local simulation එක සඳහා global max_connections සීමා කිරීම (අවශ්‍ය නම් පමණි)
  try {
    await prisma.$executeRawUnsafe(`SET GLOBAL max_connections = 25;`);
    console.log('🔒 MariaDB/MySQL max_connections temporarily set to 25');
  } catch (err) {
    console.warn('⚠️ Could not set global max_connections (requires SUPER/root privileges):', (err as Error).message);
  }

  const timer = setInterval(async () => {
    try {
      // MariaDB/MySQL active threads සහ connection pool status ලබා ගැනීම
      const results = await prisma.$queryRaw<Array<{ Variable_name: string; Value: string }>>`
        SHOW STATUS WHERE Variable_name IN (
          'Threads_connected', 
          'Threads_running', 
          'Max_used_connections', 
          'Aborted_connects',
          'Connections'
        )
      `;

      console.clear();
      console.log('=== 📊 Ecotec System - MariaDB Live Pool Monitor ===');
      console.log(`⏰ Timestamp: ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}`);
      console.log('⚙️ Target Pool Limit per Instance: 5 connections');
      console.log('----------------------------------------------------');
      console.table(results);
    } catch (error) {
      console.error('❌ Monitor Query Error:', (error as Error).message);
    }
  }, 1000);

  // Script එක close කරන විට connection එක clean ලෙස disconnect කිරීම
  process.on('SIGINT', async () => {
    clearInterval(timer);
    await prisma.$disconnect();
    console.log('\n🛑 Monitor stopped cleanly.');
    process.exit(0);
  });
}

monitorDatabase();