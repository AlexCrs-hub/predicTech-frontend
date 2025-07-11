export const getCompanyDetails = async (companyId: number) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:5000/companies/${companyId}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }
    const company = await response.json();
    return company; // Zwraca dane firmy
  } catch (error) {
    return { error: "Failed to fetch data" }; // Returns error
  }
};
