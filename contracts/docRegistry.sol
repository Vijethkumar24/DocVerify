// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract DocumentRegistry {
    struct Document {
        string filename;
        string fileType;
        string cid;
        string iv;
        string key;
    }

    mapping(string => Document) documents;

    event DocumentAdded(string documentHash, string filename, string fileType);
    event DocumentRetrieved(
        string filename,
        string fileType,
        string cid,
        string iv,
        string key,
        string documentHash
    );

    function addDocument(
        string memory documentHash,
        string memory filename,
        string memory fileType,
        string memory cid,
        string memory iv,
        string memory key
    ) public {
        if (bytes(documents[documentHash].filename).length != 0) {
            revert("Document already exists");
        }

        documents[documentHash] = Document(filename, fileType, cid, iv, key);
        emit DocumentAdded(documentHash, filename, fileType);
    }

    function verifyDocument(
        string memory documentHash
    ) public view returns (bool) {
        return bytes(documents[documentHash].filename).length != 0;
    }

    function getDocument(
        string memory documentHash,
        string memory providedKey
    )
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            string memory
        )
    {
        Document storage doc = documents[documentHash];

        require(bytes(doc.filename).length != 0, "Document does not exist");

        if (
            keccak256(abi.encodePacked(doc.key)) !=
            keccak256(abi.encodePacked(providedKey))
        ) {
            revert("Key is not matching with document hash");
        }

        return (
            doc.filename,
            doc.fileType,
            doc.cid,
            doc.iv,
            doc.key,
            documentHash
        );
    }
}
