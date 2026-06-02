exports.handler = async function(event, context) {
  // ตรวจสอบว่ามี environment variables ครบหรือไม่
  if (!process.env.GITHUB_USERNAME || !process.env.GITHUB_REPO || !process.env.GITHUB_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing GitHub configuration" })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      username: process.env.GITHUB_USERNAME,
      repo: process.env.GITHUB_REPO,
      token: process.env.GITHUB_TOKEN,
      filename: process.env.MOD_FILENAME || 'mod.json',
      categoriesFilename: process.env.CATEGORIES_FILENAME || 'categories.json',
      usersFilename: process.env.USERS_FILENAME || 'users.json',
      topupsFilename: process.env.TOPUPS_FILENAME || 'topups.json'
    })
  };
};
