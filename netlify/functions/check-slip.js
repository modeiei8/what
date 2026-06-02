// netlify/functions/check-slip.js

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: "Method not allowed" }) };
  }

  // ใช้เฉพาะตัวแปรของ SlipOK และ Discord
  const { SLIPOK_BRANCH_ID, SLIPOK_API_KEY, DISCORD_WEBHOOK_URL } = process.env;

  if (!SLIPOK_BRANCH_ID || !SLIPOK_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "Missing SlipOK Config" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Invalid JSON" }) };
  }

  const { imageBase64, username } = payload;
  if (!imageBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "No image data" }) };
  }

  try {
    // ส่งตรวจกับ SlipOK
    const slipResp = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-authorization": SLIPOK_API_KEY,
      },
      body: JSON.stringify({ files: imageBase64, log: true }),
    });

    const slipData = await slipResp.json().catch(() => null);

    if (!slipResp.ok || !slipData || !slipData.success) {
      return {
        statusCode: slipResp.status || 400,
        headers,
        body: JSON.stringify({ success: false, message: slipData?.message || "สลิปไม่ผ่านการตรวจสอบ" })
      };
    }

    const slipInfo = slipData.data;
    const amount = slipInfo.amount || 0;

    // เช็คอายุสลิปไม่เกิน 10 นาที
    if (slipInfo.transDate) {
      const slipTime = new Date(slipInfo.transDate).getTime();
      const diffMinutes = (Date.now() - slipTime) / (1000 * 60);

      if (diffMinutes > 10) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: `สลิปเก่าเกินไป (${Math.floor(diffMinutes)} นาที) กรุณาใช้สลิปที่โอนภายใน 10 นาที`
          })
        };
      }
    }

    // แจ้งเตือนเข้า Discord
    if (DISCORD_WEBHOOK_URL && username && amount > 0) {
      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "💰 มีรายการเติมเงินใหม่เข้าเว็บ!",
              color: 3066993,
              fields: [
                { name: "👤 ผู้ใช้งาน", value: username, inline: true },
                { name: "💵 จำนวนเงิน", value: `${amount} บาท`, inline: true },
                { name: "🏦 ธนาคารต้นทาง", value: slipInfo.sendingBank || "-", inline: false },
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch (e) {
        console.error("Discord Error:", e);
      }
    }

    // ส่งข้อมูลให้ Frontend จัดการอัปเดต GitHub Database
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: slipInfo
      }),
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "System Error: " + err.message }) };
  }
};