// components/EmailPhotosSection.js

export default function EmailPhotosSection({ wo, woNumber, building, description, status, currentUser }) {
  const handleEmailPhotos = () => {
    const subject = encodeURIComponent(`Photos - ${woNumber} - ${building}`);
    const body = encodeURIComponent(
      `Work Order: ${woNumber}\n` +
      `Building: ${building}\n` +
      `Description: ${description}\n` +
      `Status: ${status.replace('_', ' ').toUpperCase()}\n` +
      `Submitted by: ${currentUser.first_name} ${currentUser.last_name}\n` +
      `Date: ${new Date().toLocaleString()}\n\n` +
      `--- Attach photos below ---`
    );
    const mailtoLink = `mailto:emfcbre@gmail.com?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3">📸 Send Photos</h3>
      <p className="text-sm text-gray-400 mb-3">
        Take photos and email them for this work order
      </p>
      <button
        onClick={handleEmailPhotos}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-2xl">📸</span>
        <span>Email Photos to Office</span>
      </button>
    </div>
  );
}
